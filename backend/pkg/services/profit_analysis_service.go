package services

import (
	"api/pkg/models"
	"time"

	"gorm.io/gorm"
)

// ProfitAnalysisService provides detailed profit/loss analysis
type ProfitAnalysisService struct {
	db *gorm.DB
}

// NewProfitAnalysisService creates a new ProfitAnalysisService
func NewProfitAnalysisService(db *gorm.DB) *ProfitAnalysisService {
	return &ProfitAnalysisService{db: db}
}

// ProfitByPeriod represents profit data for a time period
type ProfitByPeriod struct {
	Period          string  `json:"period"`
	TotalProfitCAD  float64 `json:"totalProfitCad"`
	SettlementCount int     `json:"settlementCount"`
	VolumeIRR       float64 `json:"volumeIrr"`
	AvgSpread       float64 `json:"avgSpread"` // Average rate spread percentage
}

// ProfitByBranch represents profit data for a branch
type ProfitByBranch struct {
	BranchID        uint    `json:"branchId"`
	BranchName      string  `json:"branchName"`
	TotalProfitCAD  float64 `json:"totalProfitCad"`
	SettlementCount int     `json:"settlementCount"`
	VolumeIRR       float64 `json:"volumeIrr"`
	Percentage      float64 `json:"percentage"`
}

// ProfitByCurrencyPair represents profit data for a currency pair
type ProfitByCurrencyPair struct {
	BaseCurrency     string  `json:"baseCurrency"`
	TargetCurrency   string  `json:"targetCurrency"`
	TotalProfitCAD   float64 `json:"totalProfitCad"`
	TransactionCount int     `json:"transactionCount"`
	VolumeBase       float64 `json:"volumeBase"`
	VolumeTarget     float64 `json:"volumeTarget"`
	AvgRate          float64 `json:"avgRate"`
	Percentage       float64 `json:"percentage"`
}

// ProfitByCustomerSegment represents profit by customer type
type ProfitByCustomerSegment struct {
	Segment          string  `json:"segment"` // VIP, Regular, New
	CustomerCount    int     `json:"customerCount"`
	TotalProfitCAD   float64 `json:"totalProfitCad"`
	TransactionCount int     `json:"transactionCount"`
	AvgProfitPerTxn  float64 `json:"avgProfitPerTxn"`
	Percentage       float64 `json:"percentage"`
}

// RateSpreadAnalysis provides rate spread statistics
type RateSpreadAnalysis struct {
	AvgBuyRate  float64 `json:"avgBuyRate"`
	AvgSellRate float64 `json:"avgSellRate"`
	AvgSpread   float64 `json:"avgSpread"`
	SpreadPct   float64 `json:"spreadPct"`
	MinSpread   float64 `json:"minSpread"`
	MaxSpread   float64 `json:"maxSpread"`
}

// TrendComparison compares current period to previous periods
type TrendComparison struct {
	CurrentPeriodProfit  float64 `json:"currentPeriodProfit"`
	PreviousPeriodProfit float64 `json:"previousPeriodProfit"`
	ChangeAmount         float64 `json:"changeAmount"`
	ChangePercentage     float64 `json:"changePercentage"`
	IsPositive           bool    `json:"isPositive"`
}

// ProfitAnalysisResult is the comprehensive profit analysis result
type ProfitAnalysisResult struct {
	// Summary
	TotalProfitCAD         float64 `json:"totalProfitCad"`
	TotalVolumeIRR         float64 `json:"totalVolumeIrr"`
	TotalSettlements       int     `json:"totalSettlements"`
	AvgProfitPerSettlement float64 `json:"avgProfitPerSettlement"`

	// Breakdowns
	ByPeriod          []ProfitByPeriod          `json:"byPeriod"`
	ByBranch          []ProfitByBranch          `json:"byBranch"`
	ByCurrencyPair    []ProfitByCurrencyPair    `json:"byCurrencyPair"`
	ByCustomerSegment []ProfitByCustomerSegment `json:"byCustomerSegment"`

	// Analysis
	RateSpread RateSpreadAnalysis `json:"rateSpread"`

	// Trends
	VsLastMonth TrendComparison `json:"vsLastMonth"`
	VsLastYear  TrendComparison `json:"vsLastYear"`

	// Period
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
}

// GetProfitAnalysis returns comprehensive profit analysis
func (s *ProfitAnalysisService) GetProfitAnalysis(tenantID uint, startDate, endDate time.Time) (*ProfitAnalysisResult, error) {
	result := &ProfitAnalysisResult{
		StartDate: startDate,
		EndDate:   endDate,
	}

	// Get summary from settlements
	var summaryResult struct {
		TotalProfit     float64
		TotalVolume     float64
		SettlementCount int
		AvgBuyRate      float64
		AvgSellRate     float64
	}

	s.db.Model(&models.RemittanceSettlement{}).
		Select(`
			COALESCE(SUM(profit_cad), 0) as total_profit,
			COALESCE(SUM(settled_amount_irr), 0) as total_volume,
			COUNT(*) as settlement_count,
			COALESCE(AVG(outgoing_buy_rate), 0) as avg_buy_rate,
			COALESCE(AVG(incoming_sell_rate), 0) as avg_sell_rate
		`).
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Scan(&summaryResult)

	result.TotalProfitCAD = summaryResult.TotalProfit
	result.TotalVolumeIRR = summaryResult.TotalVolume
	result.TotalSettlements = summaryResult.SettlementCount
	if result.TotalSettlements > 0 {
		result.AvgProfitPerSettlement = result.TotalProfitCAD / float64(result.TotalSettlements)
	}

	// Rate spread analysis
	result.RateSpread = RateSpreadAnalysis{
		AvgBuyRate:  summaryResult.AvgBuyRate,
		AvgSellRate: summaryResult.AvgSellRate,
	}
	if summaryResult.AvgSellRate > 0 {
		result.RateSpread.AvgSpread = summaryResult.AvgBuyRate - summaryResult.AvgSellRate
		result.RateSpread.SpreadPct = (result.RateSpread.AvgSpread / summaryResult.AvgSellRate) * 100
	}

	// Profit by period (daily breakdown)
	result.ByPeriod = s.getProfitByPeriod(tenantID, startDate, endDate)

	// Profit by branch
	result.ByBranch = s.getProfitByBranch(tenantID, startDate, endDate, result.TotalProfitCAD)

	// Profit by currency pair (from transactions)
	result.ByCurrencyPair = s.getProfitByCurrencyPair(tenantID, startDate, endDate)

	// Customer segments
	result.ByCustomerSegment = s.getProfitByCustomerSegment(tenantID, startDate, endDate, result.TotalProfitCAD)

	// Trends
	result.VsLastMonth = s.getTrendComparison(tenantID, startDate, endDate, "month")
	result.VsLastYear = s.getTrendComparison(tenantID, startDate, endDate, "year")

	return result, nil
}

func (s *ProfitAnalysisService) getProfitByPeriod(tenantID uint, startDate, endDate time.Time) []ProfitByPeriod {
	var results []struct {
		Period          string
		TotalProfit     float64
		SettlementCount int
		VolumeIRR       float64
		AvgBuyRate      float64
		AvgSellRate     float64
	}

	s.db.Model(&models.RemittanceSettlement{}).
		Select(`
			DATE(created_at) as period,
			COALESCE(SUM(profit_cad), 0) as total_profit,
			COUNT(*) as settlement_count,
			COALESCE(SUM(settled_amount_irr), 0) as volume_irr,
			COALESCE(AVG(outgoing_buy_rate), 0) as avg_buy_rate,
			COALESCE(AVG(incoming_sell_rate), 0) as avg_sell_rate
		`).
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Group("DATE(created_at)").
		Order("period DESC").
		Scan(&results)

	periods := make([]ProfitByPeriod, len(results))
	for i, r := range results {
		avgSpread := 0.0
		if r.AvgSellRate > 0 {
			avgSpread = ((r.AvgBuyRate - r.AvgSellRate) / r.AvgSellRate) * 100
		}
		periods[i] = ProfitByPeriod{
			Period:          r.Period,
			TotalProfitCAD:  r.TotalProfit,
			SettlementCount: r.SettlementCount,
			VolumeIRR:       r.VolumeIRR,
			AvgSpread:       avgSpread,
		}
	}
	return periods
}

func (s *ProfitAnalysisService) getProfitByBranch(tenantID uint, startDate, endDate time.Time, totalProfit float64) []ProfitByBranch {
	var results []struct {
		BranchID        uint
		BranchName      string
		TotalProfit     float64
		SettlementCount int
		VolumeIRR       float64
	}

	s.db.Model(&models.RemittanceSettlement{}).
		Select(`
			COALESCE(outgoing_remittances.branch_id, 0) as branch_id,
			COALESCE(branches.name, 'Unassigned') as branch_name,
			COALESCE(SUM(remittance_settlements.profit_cad), 0) as total_profit,
			COUNT(*) as settlement_count,
			COALESCE(SUM(remittance_settlements.settled_amount_irr), 0) as volume_irr
		`).
		Joins("LEFT JOIN outgoing_remittances ON remittance_settlements.outgoing_remittance_id = outgoing_remittances.id").
		Joins("LEFT JOIN branches ON outgoing_remittances.branch_id = branches.id").
		Where("remittance_settlements.tenant_id = ? AND remittance_settlements.created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Group("outgoing_remittances.branch_id, branches.name").
		Order("total_profit DESC").
		Scan(&results)

	branches := make([]ProfitByBranch, len(results))
	for i, r := range results {
		pct := 0.0
		if totalProfit > 0 {
			pct = (r.TotalProfit / totalProfit) * 100
		}
		branches[i] = ProfitByBranch{
			BranchID:        r.BranchID,
			BranchName:      r.BranchName,
			TotalProfitCAD:  r.TotalProfit,
			SettlementCount: r.SettlementCount,
			VolumeIRR:       r.VolumeIRR,
			Percentage:      pct,
		}
	}
	return branches
}

func (s *ProfitAnalysisService) getProfitByCurrencyPair(tenantID uint, startDate, endDate time.Time) []ProfitByCurrencyPair {
	var results []struct {
		SendCurrency    string
		ReceiveCurrency string
		TotalProfit     float64
		TxnCount        int
		VolumeSend      float64
		VolumeReceive   float64
		AvgRate         float64
	}

	// This uses transactions table for currency pair analysis
	s.db.Model(&models.Transaction{}).
		Select(`
			send_currency,
			receive_currency,
			COALESCE(SUM(fee_charged), 0) as total_profit,
			COUNT(*) as txn_count,
			COALESCE(SUM(send_amount), 0) as volume_send,
			COALESCE(SUM(receive_amount), 0) as volume_receive,
			COALESCE(AVG(rate_applied), 0) as avg_rate
		`).
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate).
		Group("send_currency, receive_currency").
		Order("total_profit DESC").
		Scan(&results)

	totalProfit := 0.0
	for _, r := range results {
		totalProfit += r.TotalProfit
	}

	pairs := make([]ProfitByCurrencyPair, len(results))
	for i, r := range results {
		pct := 0.0
		if totalProfit > 0 {
			pct = (r.TotalProfit / totalProfit) * 100
		}
		pairs[i] = ProfitByCurrencyPair{
			BaseCurrency:     r.SendCurrency,
			TargetCurrency:   r.ReceiveCurrency,
			TotalProfitCAD:   r.TotalProfit,
			TransactionCount: r.TxnCount,
			VolumeBase:       r.VolumeSend,
			VolumeTarget:     r.VolumeReceive,
			AvgRate:          r.AvgRate,
			Percentage:       pct,
		}
	}
	return pairs
}

func (s *ProfitAnalysisService) getProfitByCustomerSegment(tenantID uint, startDate, endDate time.Time, totalProfit float64) []ProfitByCustomerSegment {
	// Define segments based on transaction count
	// VIP: 10+ transactions, Regular: 3-9 transactions, New: 1-2 transactions

	var results []struct {
		Segment     string
		CustCount   int
		TotalProfit float64
		TxnCount    int
	}

	segmentSQL := `
		WITH customer_stats AS (
			SELECT 
				client_id,
				COUNT(*) as txn_count,
				SUM(fee_charged) as total_fees
			FROM transactions 
			WHERE tenant_id = ? AND status = 'COMPLETED' AND transaction_date BETWEEN ? AND ?
			GROUP BY client_id
		)
		SELECT 
			CASE 
				WHEN txn_count >= 10 THEN 'VIP'
				WHEN txn_count >= 3 THEN 'Regular'
				ELSE 'New'
			END as segment,
			COUNT(DISTINCT client_id) as cust_count,
			SUM(total_fees) as total_profit,
			SUM(txn_count) as txn_count
		FROM customer_stats
		GROUP BY segment
		ORDER BY total_profit DESC
	`

	s.db.Raw(segmentSQL, tenantID, startDate, endDate).Scan(&results)

	segments := make([]ProfitByCustomerSegment, len(results))
	for i, r := range results {
		avgProfit := 0.0
		if r.TxnCount > 0 {
			avgProfit = r.TotalProfit / float64(r.TxnCount)
		}
		pct := 0.0
		if totalProfit > 0 {
			pct = (r.TotalProfit / totalProfit) * 100
		}
		segments[i] = ProfitByCustomerSegment{
			Segment:          r.Segment,
			CustomerCount:    r.CustCount,
			TotalProfitCAD:   r.TotalProfit,
			TransactionCount: r.TxnCount,
			AvgProfitPerTxn:  avgProfit,
			Percentage:       pct,
		}
	}
	return segments
}

func (s *ProfitAnalysisService) getTrendComparison(tenantID uint, startDate, endDate time.Time, compareType string) TrendComparison {
	duration := endDate.Sub(startDate)

	var prevStart, prevEnd time.Time
	if compareType == "month" {
		prevEnd = startDate.AddDate(0, 0, -1)
		prevStart = prevEnd.Add(-duration)
	} else { // year
		prevStart = startDate.AddDate(-1, 0, 0)
		prevEnd = endDate.AddDate(-1, 0, 0)
	}

	// Current period profit
	var currentProfit float64
	s.db.Model(&models.RemittanceSettlement{}).
		Select("COALESCE(SUM(profit_cad), 0)").
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Scan(&currentProfit)

	// Previous period profit
	var previousProfit float64
	s.db.Model(&models.RemittanceSettlement{}).
		Select("COALESCE(SUM(profit_cad), 0)").
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, prevStart, prevEnd).
		Scan(&previousProfit)

	change := currentProfit - previousProfit
	changePct := 0.0
	if previousProfit > 0 {
		changePct = (change / previousProfit) * 100
	}

	return TrendComparison{
		CurrentPeriodProfit:  currentProfit,
		PreviousPeriodProfit: previousProfit,
		ChangeAmount:         change,
		ChangePercentage:     changePct,
		IsPositive:           change >= 0,
	}
}

// GetDailyProfit returns daily profit for the specified period
func (s *ProfitAnalysisService) GetDailyProfit(tenantID uint, days int) ([]ProfitByPeriod, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)
	return s.getProfitByPeriod(tenantID, startDate, endDate), nil
}

// GetMonthlyProfit returns monthly profit summary
func (s *ProfitAnalysisService) GetMonthlyProfit(tenantID uint, months int) ([]ProfitByPeriod, error) {
	var results []struct {
		Period          string
		TotalProfit     float64
		SettlementCount int
		VolumeIRR       float64
	}

	endDate := time.Now()
	startDate := endDate.AddDate(0, -months, 0)

	s.db.Model(&models.RemittanceSettlement{}).
		Select(`
			strftime('%Y-%m', created_at) as period,
			COALESCE(SUM(profit_cad), 0) as total_profit,
			COUNT(*) as settlement_count,
			COALESCE(SUM(settled_amount_irr), 0) as volume_irr
		`).
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Group("strftime('%Y-%m', created_at)").
		Order("period DESC").
		Scan(&results)

	periods := make([]ProfitByPeriod, len(results))
	for i, r := range results {
		periods[i] = ProfitByPeriod{
			Period:          r.Period,
			TotalProfitCAD:  r.TotalProfit,
			SettlementCount: r.SettlementCount,
			VolumeIRR:       r.VolumeIRR,
		}
	}
	return periods, nil
}
