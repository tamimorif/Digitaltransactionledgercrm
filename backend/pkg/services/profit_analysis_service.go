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
func (s *ProfitAnalysisService) GetProfitAnalysis(tenantID uint, branchID *uint, startDate, endDate time.Time) (*ProfitAnalysisResult, error) {
	result := &ProfitAnalysisResult{
		StartDate: startDate,
		EndDate:   endDate,
	}

	// Get summary from transactions
	var summaryResult struct {
		TotalProfit     float64
		TotalVolume     float64
		SettlementCount int
		AvgRate         float64
	}

	// We use transactions table now
	query := s.db.Model(&models.Transaction{}).
		Select(`
			COALESCE(SUM(profit + fee_charged), 0) as total_profit,
			COALESCE(SUM(send_amount), 0) as total_volume,
			COUNT(*) as settlement_count,
			COALESCE(AVG(rate_applied), 0) as avg_rate
		`).
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	query.Scan(&summaryResult)

	result.TotalProfitCAD = summaryResult.TotalProfit
	result.TotalVolumeIRR = summaryResult.TotalVolume // Note: This might be mixed currencies if not filtered
	result.TotalSettlements = summaryResult.SettlementCount
	if result.TotalSettlements > 0 {
		result.AvgProfitPerSettlement = result.TotalProfitCAD / float64(result.TotalSettlements)
	}

	// Rate spread analysis (Simplified for now as we aggregate mixed pairs)
	result.RateSpread = RateSpreadAnalysis{
		AvgSellRate: summaryResult.AvgRate,
	}

	// Profit by period (daily breakdown)
	result.ByPeriod = s.GetProfitByPeriod(tenantID, branchID, startDate, endDate)

	// Profit by branch (if branchID is set, this will just return the one branch, which is fine)
	result.ByBranch = s.GetProfitByBranch(tenantID, branchID, startDate, endDate, result.TotalProfitCAD)

	// Profit by currency pair (from transactions)
	result.ByCurrencyPair = s.GetProfitByCurrencyPair(tenantID, branchID, startDate, endDate)

	// Customer segments
	result.ByCustomerSegment = s.GetProfitByCustomerSegment(tenantID, branchID, startDate, endDate, result.TotalProfitCAD)

	// Trends
	result.VsLastMonth = s.GetTrendComparison(tenantID, branchID, startDate, endDate, "month")
	result.VsLastYear = s.GetTrendComparison(tenantID, branchID, startDate, endDate, "year")

	return result, nil
}

func (s *ProfitAnalysisService) GetProfitByPeriod(tenantID uint, branchID *uint, startDate, endDate time.Time) []ProfitByPeriod {
	var results []struct {
		Period          string
		TotalProfit     float64
		SettlementCount int
		Volume          float64
	}

	query := s.db.Model(&models.Transaction{}).
		Select(`
			DATE(transaction_date) as period,
			COALESCE(SUM(profit + fee_charged), 0) as total_profit,
			COUNT(*) as settlement_count,
			COALESCE(SUM(send_amount), 0) as volume
		`).
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	query.Group("DATE(transaction_date)").
		Order("period DESC").
		Scan(&results)

	periods := make([]ProfitByPeriod, len(results))
	for i, r := range results {
		periods[i] = ProfitByPeriod{
			Period:          r.Period,
			TotalProfitCAD:  r.TotalProfit,
			SettlementCount: r.SettlementCount,
			VolumeIRR:       r.Volume, // Renaming field in struct might be better later
			AvgSpread:       0,        // Hard to calc avg spread across mixed currencies
		}
	}
	return periods
}

func (s *ProfitAnalysisService) GetProfitByBranch(tenantID uint, branchID *uint, startDate, endDate time.Time, totalProfit float64) []ProfitByBranch {
	var results []struct {
		BranchID        uint
		BranchName      string
		TotalProfit     float64
		SettlementCount int
		Volume          float64
	}

	query := s.db.Model(&models.Transaction{}).
		Select(`
			COALESCE(transactions.branch_id, 0) as branch_id,
			COALESCE(branches.name, 'Unassigned') as branch_name,
			COALESCE(SUM(transactions.profit + transactions.fee_charged), 0) as total_profit,
			COUNT(*) as settlement_count,
			COALESCE(SUM(transactions.send_amount), 0) as volume
		`).
		Joins("LEFT JOIN branches ON transactions.branch_id = branches.id").
		Where("transactions.tenant_id = ? AND transactions.status = ? AND transactions.transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("transactions.branch_id = ?", *branchID)
	}

	query.Group("transactions.branch_id, branches.name").
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
			VolumeIRR:       r.Volume,
			Percentage:      pct,
		}
	}
	return branches
}

func (s *ProfitAnalysisService) GetProfitByCurrencyPair(tenantID uint, branchID *uint, startDate, endDate time.Time) []ProfitByCurrencyPair {
	var results []struct {
		SendCurrency    string
		ReceiveCurrency string
		TotalProfit     float64
		TxnCount        int
		VolumeSend      float64
		VolumeReceive   float64
		AvgRate         float64
	}

	query := s.db.Model(&models.Transaction{}).
		Select(`
			send_currency,
			receive_currency,
			COALESCE(SUM(profit + fee_charged), 0) as total_profit,
			COUNT(*) as txn_count,
			COALESCE(SUM(send_amount), 0) as volume_send,
			COALESCE(SUM(receive_amount), 0) as volume_receive,
			COALESCE(AVG(rate_applied), 0) as avg_rate
		`).
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	query.Group("send_currency, receive_currency").
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

func (s *ProfitAnalysisService) GetProfitByCustomerSegment(tenantID uint, branchID *uint, startDate, endDate time.Time, totalProfit float64) []ProfitByCustomerSegment {
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
				SUM(profit + fee_charged) as total_gain
			FROM transactions 
			WHERE tenant_id = ? AND status = 'COMPLETED' AND transaction_date BETWEEN ? AND ?
	`
	args := []interface{}{tenantID, startDate, endDate}

	if branchID != nil {
		segmentSQL += " AND branch_id = ?"
		args = append(args, *branchID)
	}

	segmentSQL += `
			GROUP BY client_id
		)
		SELECT 
			CASE 
				WHEN txn_count >= 10 THEN 'VIP'
				WHEN txn_count >= 3 THEN 'Regular'
				ELSE 'New'
			END as segment,
			COUNT(DISTINCT client_id) as cust_count,
			SUM(total_gain) as total_profit,
			SUM(txn_count) as txn_count
		FROM customer_stats
		GROUP BY segment
		ORDER BY total_profit DESC
	`

	s.db.Raw(segmentSQL, args...).Scan(&results)

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

func (s *ProfitAnalysisService) GetTrendComparison(tenantID uint, branchID *uint, startDate, endDate time.Time, compareType string) TrendComparison {
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
	queryCurr := s.db.Model(&models.Transaction{}).
		Select("COALESCE(SUM(profit + fee_charged), 0)").
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)
	
	if branchID != nil {
		queryCurr = queryCurr.Where("branch_id = ?", *branchID)
	}
	queryCurr.Scan(&currentProfit)

	// Previous period profit
	var previousProfit float64
	queryPrev := s.db.Model(&models.Transaction{}).
		Select("COALESCE(SUM(profit + fee_charged), 0)").
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, prevStart, prevEnd)
	
	if branchID != nil {
		queryPrev = queryPrev.Where("branch_id = ?", *branchID)
	}
	queryPrev.Scan(&previousProfit)

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
func (s *ProfitAnalysisService) GetDailyProfit(tenantID uint, branchID *uint, days int) ([]ProfitByPeriod, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)
	return s.GetProfitByPeriod(tenantID, branchID, startDate, endDate), nil
}

// GetMonthlyProfit returns monthly profit summary
func (s *ProfitAnalysisService) GetMonthlyProfit(tenantID uint, branchID *uint, months int) ([]ProfitByPeriod, error) {
	var results []struct {
		Period          string
		TotalProfit     float64
		SettlementCount int
		Volume          float64
	}

	endDate := time.Now()
	startDate := endDate.AddDate(0, -months, 0)

	query := s.db.Model(&models.Transaction{}).
		Select(`
			strftime('%Y-%m', transaction_date) as period,
			COALESCE(SUM(profit + fee_charged), 0) as total_profit,
			COUNT(*) as settlement_count,
			COALESCE(SUM(send_amount), 0) as volume
		`).
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	query.Group("strftime('%Y-%m', transaction_date)").
		Order("period DESC").
		Scan(&results)

	periods := make([]ProfitByPeriod, len(results))
	for i, r := range results {
		periods[i] = ProfitByPeriod{
			Period:          r.Period,
			TotalProfitCAD:  r.TotalProfit,
			SettlementCount: r.SettlementCount,
			VolumeIRR:       r.Volume,
		}
	}
	return periods, nil
}

// CustomerProfit represents profit by customer
type CustomerProfit struct {
	CustomerID       uint    `json:"customerId"`
	CustomerName     string  `json:"customerName"`
	TotalProfit      float64 `json:"totalProfit"`
	TransactionCount int     `json:"transactionCount"`
	AverageProfit    float64 `json:"averageProfit"`
}

// GetTopCustomers returns top profitable customers
func (s *ProfitAnalysisService) GetTopCustomers(tenantID uint, branchID *uint, limit int, startDate, endDate time.Time) ([]CustomerProfit, error) {
	var results []struct {
		ClientID    uint
		ClientName  string
		TotalProfit float64
		TxnCount    int
	}

	query := s.db.Model(&models.Transaction{}).
		Select(`
			transactions.client_id,
			COALESCE(clients.name, 'Unknown') as client_name,
			COALESCE(SUM(transactions.profit + transactions.fee_charged), 0) as total_profit,
			COUNT(*) as txn_count
		`).
		Joins("LEFT JOIN clients ON transactions.client_id = clients.id").
		Where("transactions.tenant_id = ? AND transactions.status = ? AND transactions.transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("transactions.branch_id = ?", *branchID)
	}

	query.Group("transactions.client_id, clients.name").
		Order("total_profit DESC").
		Limit(limit).
		Scan(&results)

	customers := make([]CustomerProfit, len(results))
	for i, r := range results {
		avgProfit := 0.0
		if r.TxnCount > 0 {
			avgProfit = r.TotalProfit / float64(r.TxnCount)
		}
		customers[i] = CustomerProfit{
			CustomerID:       r.ClientID,
			CustomerName:     r.ClientName,
			TotalProfit:      r.TotalProfit,
			TransactionCount: r.TxnCount,
			AverageProfit:    avgProfit,
		}
	}
	return customers, nil
}
