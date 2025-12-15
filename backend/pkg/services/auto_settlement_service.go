package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"sort"
	"time"

	"gorm.io/gorm"
)

// SettlementStrategy defines how to prioritize settlements
type SettlementStrategy string

const (
	StrategyFIFO     SettlementStrategy = "FIFO"      // First In, First Out (oldest first)
	StrategyLIFO     SettlementStrategy = "LIFO"      // Last In, First Out (newest first)
	StrategyBestRate SettlementStrategy = "BEST_RATE" // Maximize profit
	StrategyManual   SettlementStrategy = "MANUAL"    // Manual selection only
)

// SettlementSuggestion represents a suggested settlement
type SettlementSuggestion struct {
	OutgoingRemittance models.OutgoingRemittance `json:"outgoingRemittance"`
	SuggestedAmountIRR float64                   `json:"suggestedAmountIrr"`
	EstimatedProfitCAD float64                   `json:"estimatedProfitCad"`
	DaysOutstanding    int                       `json:"daysOutstanding"`
	MatchScore         float64                   `json:"matchScore"` // 0-100 score for how good a match this is
	Reason             string                    `json:"reason"`
}

// AutoSettlementResult represents the result of auto-settlement
type AutoSettlementResult struct {
	Settlements     []models.RemittanceSettlement `json:"settlements"`
	TotalSettledIRR float64                       `json:"totalSettledIrr"`
	TotalProfitCAD  float64                       `json:"totalProfitCad"`
	RemainingIRR    float64                       `json:"remainingIrr"`
	SettlementCount int                           `json:"settlementCount"`
}

// AutoSettlementService handles automatic settlement logic
type AutoSettlementService struct {
	db                *gorm.DB
	remittanceService *RemittanceService
}

// NewAutoSettlementService creates a new AutoSettlementService
func NewAutoSettlementService(db *gorm.DB) *AutoSettlementService {
	return &AutoSettlementService{
		db:                db,
		remittanceService: NewRemittanceService(db),
	}
}

// GetSettlementSuggestions returns suggested settlements for an incoming remittance
func (s *AutoSettlementService) GetSettlementSuggestions(tenantID, incomingID uint, strategy SettlementStrategy, limit int) ([]SettlementSuggestion, error) {
	// Get the incoming remittance
	var incoming models.IncomingRemittance
	if err := s.db.Where("id = ? AND tenant_id = ?", incomingID, tenantID).First(&incoming).Error; err != nil {
		return nil, errors.New("incoming remittance not found")
	}

	if incoming.RemainingIRR <= 0 {
		return nil, errors.New("incoming remittance has no remaining amount to allocate")
	}

	// Get all pending/partial outgoing remittances
	var outgoings []models.OutgoingRemittance
	if err := s.db.Where("tenant_id = ? AND status IN (?, ?) AND remaining_irr > 0",
		tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial).
		Preload("Branch").
		Find(&outgoings).Error; err != nil {
		return nil, err
	}

	if len(outgoings) == 0 {
		return []SettlementSuggestion{}, nil
	}

	// Sort based on strategy
	s.sortByStrategy(outgoings, incoming, strategy)

	// Generate suggestions
	suggestions := make([]SettlementSuggestion, 0)
	remainingToAllocate := incoming.RemainingIRR

	for _, outgoing := range outgoings {
		if remainingToAllocate <= 0 {
			break
		}
		if limit > 0 && len(suggestions) >= limit {
			break
		}

		// Calculate suggested amount
		suggestedAmount := min(remainingToAllocate, outgoing.RemainingIRR)

		// Calculate estimated profit
		costCAD := suggestedAmount / outgoing.BuyRateCAD
		revenueCAD := suggestedAmount / incoming.SellRateCAD
		profit := costCAD - revenueCAD

		// Calculate days outstanding
		daysOutstanding := int(time.Since(outgoing.CreatedAt).Hours() / 24)

		// Calculate match score
		matchScore := s.calculateMatchScore(outgoing, incoming, strategy, daysOutstanding)

		// Determine reason
		reason := s.getMatchReason(outgoing, incoming, strategy, daysOutstanding)

		suggestions = append(suggestions, SettlementSuggestion{
			OutgoingRemittance: outgoing,
			SuggestedAmountIRR: suggestedAmount,
			EstimatedProfitCAD: profit,
			DaysOutstanding:    daysOutstanding,
			MatchScore:         matchScore,
			Reason:             reason,
		})

		remainingToAllocate -= suggestedAmount
	}

	return suggestions, nil
}

// AutoSettle automatically settles an incoming remittance using the specified strategy
func (s *AutoSettlementService) AutoSettle(tenantID, incomingID, userID uint, strategy SettlementStrategy) (*AutoSettlementResult, error) {
	// Get suggestions first
	suggestions, err := s.GetSettlementSuggestions(tenantID, incomingID, strategy, 0)
	if err != nil {
		return nil, err
	}

	if len(suggestions) == 0 {
		return nil, errors.New("no pending outgoing remittances to settle")
	}

	result := &AutoSettlementResult{
		Settlements:     make([]models.RemittanceSettlement, 0),
		TotalSettledIRR: 0,
		TotalProfitCAD:  0,
	}

	// Execute settlements
	for _, suggestion := range suggestions {
		settlement, err := s.remittanceService.SettleRemittance(
			tenantID,
			suggestion.OutgoingRemittance.ID,
			incomingID,
			suggestion.SuggestedAmountIRR,
			userID,
		)
		if err != nil {
			// Log error but continue with next
			continue
		}

		result.Settlements = append(result.Settlements, *settlement)
		result.TotalSettledIRR += settlement.SettledAmountIRR
		result.TotalProfitCAD += settlement.ProfitCAD
	}

	result.SettlementCount = len(result.Settlements)

	// Get remaining amount
	var incoming models.IncomingRemittance
	s.db.First(&incoming, incomingID)
	result.RemainingIRR = incoming.RemainingIRR

	return result, nil
}

// sortByStrategy sorts outgoing remittances based on the strategy
func (s *AutoSettlementService) sortByStrategy(outgoings []models.OutgoingRemittance, incoming models.IncomingRemittance, strategy SettlementStrategy) {
	switch strategy {
	case StrategyFIFO:
		// Sort by created_at ascending (oldest first)
		sort.Slice(outgoings, func(i, j int) bool {
			return outgoings[i].CreatedAt.Before(outgoings[j].CreatedAt)
		})
	case StrategyLIFO:
		// Sort by created_at descending (newest first)
		sort.Slice(outgoings, func(i, j int) bool {
			return outgoings[i].CreatedAt.After(outgoings[j].CreatedAt)
		})
	case StrategyBestRate:
		// Sort by profit potential (highest profit first)
		// Profit = AmountIRR * (1/BuyRate - 1/SellRate)
		sort.Slice(outgoings, func(i, j int) bool {
			profitI := 1/outgoings[i].BuyRateCAD - 1/incoming.SellRateCAD
			profitJ := 1/outgoings[j].BuyRateCAD - 1/incoming.SellRateCAD
			return profitI > profitJ
		})
	default:
		// Default to FIFO
		sort.Slice(outgoings, func(i, j int) bool {
			return outgoings[i].CreatedAt.Before(outgoings[j].CreatedAt)
		})
	}
}

// calculateMatchScore calculates a 0-100 score for how good a match is
func (s *AutoSettlementService) calculateMatchScore(outgoing models.OutgoingRemittance, incoming models.IncomingRemittance, strategy SettlementStrategy, daysOutstanding int) float64 {
	score := 50.0 // Base score

	// Age factor (older = higher priority, up to 30 points)
	if daysOutstanding > 0 {
		ageFactor := float64(daysOutstanding) / 30.0 * 30.0
		if ageFactor > 30 {
			ageFactor = 30
		}
		score += ageFactor
	}

	// Profit factor (higher profit = higher score, up to 20 points)
	profitMargin := (1/outgoing.BuyRateCAD - 1/incoming.SellRateCAD) * 100
	if profitMargin > 0 {
		profitFactor := profitMargin * 10
		if profitFactor > 20 {
			profitFactor = 20
		}
		score += profitFactor
	}

	// Amount match factor (closer to full settlement = better)
	if outgoing.RemainingIRR <= incoming.RemainingIRR {
		// Can fully settle this outgoing
		score += 10
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}

	return score
}

// getMatchReason returns a human-readable reason for the match
func (s *AutoSettlementService) getMatchReason(outgoing models.OutgoingRemittance, incoming models.IncomingRemittance, strategy SettlementStrategy, daysOutstanding int) string {
	switch strategy {
	case StrategyFIFO:
		if daysOutstanding > 30 {
			return "⚠️ Oldest debt - outstanding for over 30 days"
		} else if daysOutstanding > 14 {
			return fmt.Sprintf("📅 Priority - outstanding for %d days", daysOutstanding)
		}
		return "📋 FIFO order - created " + outgoing.CreatedAt.Format("Jan 2")
	case StrategyBestRate:
		profit := (1/outgoing.BuyRateCAD - 1/incoming.SellRateCAD) * outgoing.RemainingIRR
		if profit > 100 {
			return "💰 High profit potential"
		}
		return "📈 Optimized for profit"
	default:
		return "Suggested based on " + string(strategy) + " strategy"
	}
}

// GetUnsettledSummary returns a summary of unsettled outgoing remittances
func (s *AutoSettlementService) GetUnsettledSummary(tenantID uint) (map[string]interface{}, error) {
	var results []struct {
		Status       string
		Count        int
		TotalIRR     float64
		RemainingIRR float64
	}

	err := s.db.Model(&models.OutgoingRemittance{}).
		Select("status, COUNT(*) as count, SUM(amount_irr) as total_irr, SUM(remaining_irr) as remaining_irr").
		Where("tenant_id = ? AND status IN (?, ?)", tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial).
		Group("status").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	// Calculate aging
	var agingResults []struct {
		AgeBucket string
		Count     int
		TotalIRR  float64
	}

	agingSQL := `
		SELECT 
			CASE 
				WHEN julianday('now') - julianday(created_at) <= 7 THEN '0-7 days'
				WHEN julianday('now') - julianday(created_at) <= 14 THEN '8-14 days'
				WHEN julianday('now') - julianday(created_at) <= 30 THEN '15-30 days'
				ELSE '30+ days'
			END as age_bucket,
			COUNT(*) as count,
			SUM(remaining_irr) as total_irr
		FROM outgoing_remittances
		WHERE tenant_id = ? AND status IN (?, ?) AND remaining_irr > 0
		GROUP BY age_bucket
		ORDER BY 
			CASE age_bucket
				WHEN '0-7 days' THEN 1
				WHEN '8-14 days' THEN 2
				WHEN '15-30 days' THEN 3
				ELSE 4
			END
	`
	s.db.Raw(agingSQL, tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial).Scan(&agingResults)

	return map[string]interface{}{
		"byStatus": results,
		"byAge":    agingResults,
	}, nil
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
