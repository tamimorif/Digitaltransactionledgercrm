package services

import (
	"api/pkg/models"
	"fmt"
	"sync"
	"time"

	"gorm.io/gorm"
)

// DashboardService provides real-time dashboard metrics
type DashboardService struct {
	db *gorm.DB
}

// NewDashboardService creates a new DashboardService
func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{db: db}
}

// RemittanceSummary represents remittance overview
type RemittanceSummary struct {
	PendingCount   int     `json:"pendingCount"`
	PartialCount   int     `json:"partialCount"`
	TotalPending   float64 `json:"totalPendingCad"`
	TotalRemaining float64 `json:"totalRemainingIrr"`
}

// CashBalanceSummary represents cash on hand
type CashBalanceSummary struct {
	Currency string  `json:"currency"`
	Balance  float64 `json:"balance"`
}

// DailyMetrics represents today's activity
type DailyMetrics struct {
	TransactionCount  int     `json:"transactionCount"`
	TransactionVolume float64 `json:"transactionVolume"`
	NewCustomers      int     `json:"newCustomers"`
	Profit            float64 `json:"profitCad"`
}

// DebtAging represents debt aging buckets
type DebtAging struct {
	Bucket     string  `json:"bucket"` // e.g., "0-7 days", "8-14 days"
	Count      int     `json:"count"`
	TotalIRR   float64 `json:"totalIrr"`
	TotalCAD   float64 `json:"totalCad"`
	IsWarning  bool    `json:"isWarning"`
	IsCritical bool    `json:"isCritical"`
}

// RateTrend represents exchange rate trend
type RateTrend struct {
	Date     string  `json:"date"`
	BuyRate  float64 `json:"buyRate"`
	SellRate float64 `json:"sellRate"`
	Spread   float64 `json:"spread"`
}

// Alert represents a dashboard alert
type Alert struct {
	Type     string `json:"type"` // warning, error, info
	Title    string `json:"title"`
	Message  string `json:"message"`
	EntityID uint   `json:"entityId,omitempty"`
	Link     string `json:"link,omitempty"`
}

// DailyVolume represents daily transaction volume
type DailyVolume struct {
	Date     string  `json:"date"`
	Income   float64 `json:"income"`   // Money received (SendAmount)
	Outgoing float64 `json:"outgoing"` // Money sent out (ReceiveAmount converted to base?) - simplified to volume
}

// DashboardSummaryKPIs represents compact KPIs for a summary endpoint
type DashboardSummaryKPIs struct {
	TotalVolumeToday   float64 `json:"total_volume_today"`
	ProfitToday        float64 `json:"profit_today"`
	PendingRemittances int     `json:"pending_remittances"`
	IncomingPending    int     `json:"incoming_pending"`
}

// CashFlowPoint represents a simple in/out cash flow point
type CashFlowPoint struct {
	Date string  `json:"date"`
	In   float64 `json:"in"`
	Out  float64 `json:"out"`
}

// RecentTransactionSummary represents a compact recent transaction record
type RecentTransactionSummary struct {
	ID        string    `json:"id"`
	Client    string    `json:"client"`
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	CreatedAt time.Time `json:"created_at"`
}

// DashboardSummary is a compact response for a summary endpoint
type DashboardSummary struct {
	KPIs               DashboardSummaryKPIs       `json:"kpis"`
	CashFlow           []CashFlowPoint            `json:"cash_flow"`
	RecentTransactions []RecentTransactionSummary `json:"recent_transactions"`
}

// DashboardData is the complete dashboard response
type DashboardData struct {
	// Overview Cards
	OutgoingSummary RemittanceSummary    `json:"outgoingSummary"`
	IncomingSummary RemittanceSummary    `json:"incomingSummary"`
	CashBalances    []CashBalanceSummary `json:"cashBalances"`
	TodayMetrics    DailyMetrics         `json:"todayMetrics"`
	WeekMetrics     DailyMetrics         `json:"weekMetrics"`
	MonthMetrics    DailyMetrics         `json:"monthMetrics"`

	// Charts Data
	DebtAging    []DebtAging   `json:"debtAging"`
	RateTrends   []RateTrend   `json:"rateTrends"`
	DailyProfit  []DailyProfit `json:"dailyProfit"`
	DailyVolumes []DailyVolume `json:"dailyVolumes"` // New field

	// Alerts
	Alerts []Alert `json:"alerts"`

	// Quick Stats
	TotalClientsCount      int `json:"totalClientsCount"`
	ActiveRemittancesCount int `json:"activeRemittancesCount"`
	PendingPickupsCount    int `json:"pendingPickupsCount"`

	// Last Updated
	LastUpdated time.Time `json:"lastUpdated"`
}

// GetDashboardData returns comprehensive dashboard data
// Uses parallel query execution for improved performance
func (s *DashboardService) GetDashboardData(tenantID uint, branchID *uint) (*DashboardData, error) {
	dashboard := &DashboardData{
		LastUpdated: time.Now(),
		Alerts:      make([]Alert, 0),
	}

	var wg sync.WaitGroup

	// Parallel fetching of independent data
	wg.Add(11) // Increased from 10

	// Get outgoing summary
	go func() {
		defer wg.Done()
		dashboard.OutgoingSummary = s.getRemittanceSummary(tenantID, branchID, "outgoing")
	}()

	// Get incoming summary
	go func() {
		defer wg.Done()
		dashboard.IncomingSummary = s.getRemittanceSummary(tenantID, branchID, "incoming")
	}()

	// Get cash balances
	go func() {
		defer wg.Done()
		dashboard.CashBalances = s.getCashBalances(tenantID, branchID)
	}()

	// Get metrics - today, week, month
	go func() {
		defer wg.Done()
		dashboard.TodayMetrics = s.getMetrics(tenantID, branchID, time.Now().Truncate(24*time.Hour), time.Now())
	}()
	go func() {
		defer wg.Done()
		weekStart := time.Now().AddDate(0, 0, -7)
		dashboard.WeekMetrics = s.getMetrics(tenantID, branchID, weekStart, time.Now())
	}()
	go func() {
		defer wg.Done()
		monthStart := time.Now().AddDate(0, -1, 0)
		dashboard.MonthMetrics = s.getMetrics(tenantID, branchID, monthStart, time.Now())
	}()

	// Get debt aging
	go func() {
		defer wg.Done()
		dashboard.DebtAging = s.getDebtAging(tenantID, branchID)
	}()

	// Get rate trends (last 7 days)
	go func() {
		defer wg.Done()
		dashboard.RateTrends = s.getRateTrends(tenantID, 7)
	}()

	// Get daily profit (last 30 days)
	go func() {
		defer wg.Done()
		dashboard.DailyProfit = s.getDailyProfit(tenantID, 30)
	}()

	// Get daily volume (last 30 days) - NEW
	go func() {
		defer wg.Done()
		dashboard.DailyVolumes = s.getDailyVolume(tenantID, branchID, 30)
	}()

	// Get quick stats (combined into one goroutine)
	go func() {
		defer wg.Done()
		dashboard.TotalClientsCount = s.getClientCount(tenantID)
		dashboard.ActiveRemittancesCount = s.getActiveRemittanceCount(tenantID)
		dashboard.PendingPickupsCount = s.getPendingPickupCount(tenantID)
	}()

	// Wait for all queries to complete
	wg.Wait()

	// Generate alerts (depends on other data, so must run after)
	dashboard.Alerts = s.generateAlerts(tenantID, branchID, dashboard)

	return dashboard, nil
}

// GetDashboardSummary returns a compact summary payload for the dashboard
func (s *DashboardService) GetDashboardSummary(tenantID uint, branchID *uint) (*DashboardSummary, error) {
	summary := &DashboardSummary{}

	// KPIs
	startOfDay := time.Now().Truncate(24 * time.Hour)
	todayMetrics := s.getMetrics(tenantID, branchID, startOfDay, time.Now())
	outgoingSummary := s.getRemittanceSummary(tenantID, branchID, "outgoing")
	incomingSummary := s.getRemittanceSummary(tenantID, branchID, "incoming")

	summary.KPIs = DashboardSummaryKPIs{
		TotalVolumeToday:   todayMetrics.TransactionVolume,
		ProfitToday:        todayMetrics.Profit,
		PendingRemittances: outgoingSummary.PendingCount,
		IncomingPending:    incomingSummary.PendingCount,
	}

	// Cash Flow (last 30 days)
	volumes := s.getDailyVolume(tenantID, branchID, 30)
	summary.CashFlow = make([]CashFlowPoint, 0, len(volumes))
	for _, v := range volumes {
		summary.CashFlow = append(summary.CashFlow, CashFlowPoint{
			Date: v.Date,
			In:   v.Income,
			Out:  v.Outgoing,
		})
	}

	// Recent Transactions
	var transactions []models.Transaction
	query := s.db.Model(&models.Transaction{}).
		Preload("Client").
		Where("tenant_id = ? AND status = ?", tenantID, models.StatusCompleted).
		Order("transaction_date DESC, created_at DESC").
		Limit(10)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	if err := query.Find(&transactions).Error; err != nil {
		return nil, err
	}

	summary.RecentTransactions = make([]RecentTransactionSummary, 0, len(transactions))
	for _, tx := range transactions {
		clientName := "Walk-in Customer"
		if tx.Client != nil && tx.Client.Name != "" {
			clientName = tx.Client.Name
		}

		summary.RecentTransactions = append(summary.RecentTransactions, RecentTransactionSummary{
			ID:        tx.ID,
			Client:    clientName,
			Amount:    tx.SendAmount.Float64(),
			Currency:  tx.SendCurrency,
			CreatedAt: tx.TransactionDate,
		})
	}

	return summary, nil
}

func (s *DashboardService) getDailyVolume(tenantID uint, branchID *uint, days int) []DailyVolume {
	var results []DailyVolume

	// Simple query: Group by date, sum SendAmount (Income)
	// For "Outgoing", typically in a ledger, we might look at payouts.
	// For now, let's map:
	// Income = Sum(SendAmount) for standard transactions (Money IN)
	// Outgoing = Sum(ReceiveAmount) converted to Base? Or withdrawals?
	// Let's stick to Transaction Volume as "Income" for this chart as requested by "Cash Flow" often implies In/Out.
	// If the frontend wants "Volume", usually it means Total Traded Volume.
	// If it wants "Cash Flow", it means Deposits vs Withdrawals.
	// Let's assume Income = Total Received, Outgoing = Total Paid Out (e.g. from cash balances).

	// Actually, let's use the `transactions` table.
	// Income: Sum of `send_amount` (client gives us money)
	// Outgoing: We don't track our payouts in `transactions` well unless we check `payments` or specific types.
	// Let's simplify: Income = SendAmount (Volume). Outgoing = 0 for now until we have better payout tracking.

	// Wait, Codex plan said: "Income map to send_amount, Outgoing to receive_amount".
	// Let's do that.

	query := s.db.Model(&models.Transaction{}).
		Select("DATE(transaction_date) as date, COALESCE(SUM(send_amount), 0) as income, COALESCE(SUM(receive_amount), 0) as outgoing").
		Where("tenant_id = ? AND transaction_date >= date('now', ?) AND status = ?", tenantID, fmt.Sprintf("-%d days", days), models.StatusCompleted)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	query.Group("DATE(transaction_date)").
		Order("date ASC").
		Scan(&results)

	return results
}

func (s *DashboardService) getRemittanceSummary(tenantID uint, branchID *uint, remittanceType string) RemittanceSummary {
	var summary RemittanceSummary

	var tableName string
	if remittanceType == "outgoing" {
		tableName = "outgoing_remittances"
	} else {
		tableName = "incoming_remittances"
	}

	query := s.db.Table(tableName).
		Where("tenant_id = ? AND status IN (?, ?)", tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	// Count by status
	var results []struct {
		Status string
		Count  int
	}
	query.Select("status, COUNT(*) as count").Group("status").Scan(&results)

	for _, r := range results {
		if r.Status == models.RemittanceStatusPending {
			summary.PendingCount = r.Count
		} else if r.Status == models.RemittanceStatusPartial {
			summary.PartialCount = r.Count
		}
	}

	// Get totals
	var totals struct {
		TotalRemaining float64
		TotalCAD       float64
	}

	query2 := s.db.Table(tableName).
		Where("tenant_id = ? AND status IN (?, ?)", tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial)
	if branchID != nil {
		query2 = query2.Where("branch_id = ?", *branchID)
	}

	if remittanceType == "outgoing" {
		query2.Select("COALESCE(SUM(remaining_irr), 0) as total_remaining, COALESCE(SUM(equivalent_cad), 0) as total_cad").Scan(&totals)
	} else {
		query2.Select("COALESCE(SUM(remaining_irr), 0) as total_remaining, COALESCE(SUM(equivalent_cad), 0) as total_cad").Scan(&totals)
	}

	summary.TotalRemaining = totals.TotalRemaining
	summary.TotalPending = totals.TotalCAD

	return summary
}

func (s *DashboardService) getCashBalances(tenantID uint, branchID *uint) []CashBalanceSummary {
	var balances []CashBalanceSummary

	query := s.db.Model(&models.CashBalance{}).
		Select("currency, COALESCE(SUM(final_balance), 0) as balance").
		Where("tenant_id = ?", tenantID)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	query.Group("currency").Scan(&balances)
	return balances
}

func (s *DashboardService) getMetrics(tenantID uint, branchID *uint, startDate, endDate time.Time) DailyMetrics {
	var metrics DailyMetrics

	// Transaction stats
	query := s.db.Model(&models.Transaction{}).
		Where("tenant_id = ? AND status = ? AND transaction_date BETWEEN ? AND ?",
			tenantID, models.StatusCompleted, startDate, endDate)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	var txnStats struct {
		Count  int
		Volume float64
	}
	query.Select("COUNT(*) as count, COALESCE(SUM(send_amount), 0) as volume").Scan(&txnStats)
	metrics.TransactionCount = txnStats.Count
	metrics.TransactionVolume = txnStats.Volume

	// Profit from settlements
	var profitResult float64
	s.db.Model(&models.RemittanceSettlement{}).
		Select("COALESCE(SUM(profit_cad), 0)").
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Scan(&profitResult)
	metrics.Profit = profitResult

	// New customers
	var newCustomerCount int64
	s.db.Model(&models.Client{}).
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Count(&newCustomerCount)
	metrics.NewCustomers = int(newCustomerCount)

	return metrics
}

func (s *DashboardService) getDebtAging(tenantID uint, branchID *uint) []DebtAging {
	buckets := []DebtAging{
		{Bucket: "0-7 days", IsWarning: false, IsCritical: false},
		{Bucket: "8-14 days", IsWarning: false, IsCritical: false},
		{Bucket: "15-30 days", IsWarning: true, IsCritical: false},
		{Bucket: "30+ days", IsWarning: false, IsCritical: true},
	}

	query := `
		SELECT 
			CASE 
				WHEN julianday('now') - julianday(created_at) <= 7 THEN 0
				WHEN julianday('now') - julianday(created_at) <= 14 THEN 1
				WHEN julianday('now') - julianday(created_at) <= 30 THEN 2
				ELSE 3
			END as bucket_idx,
			COUNT(*) as count,
			COALESCE(SUM(remaining_irr), 0) as total_irr,
			COALESCE(SUM(remaining_irr / buy_rate_cad), 0) as total_cad
		FROM outgoing_remittances
		WHERE tenant_id = ? AND status IN (?, ?) AND remaining_irr > 0
	`

	if branchID != nil {
		query += " AND branch_id = ?"
	}
	query += " GROUP BY bucket_idx ORDER BY bucket_idx"

	var results []struct {
		BucketIdx int
		Count     int
		TotalIRR  float64
		TotalCAD  float64
	}

	if branchID != nil {
		s.db.Raw(query, tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial, *branchID).Scan(&results)
	} else {
		s.db.Raw(query, tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial).Scan(&results)
	}

	for _, r := range results {
		if r.BucketIdx >= 0 && r.BucketIdx < len(buckets) {
			buckets[r.BucketIdx].Count = r.Count
			buckets[r.BucketIdx].TotalIRR = r.TotalIRR
			buckets[r.BucketIdx].TotalCAD = r.TotalCAD
		}
	}

	return buckets
}

func (s *DashboardService) getRateTrends(tenantID uint, days int) []RateTrend {
	var trends []RateTrend

	// Get average rates from settlements per day
	query := `
		SELECT 
			DATE(created_at) as date,
			AVG(outgoing_buy_rate) as buy_rate,
			AVG(incoming_sell_rate) as sell_rate
		FROM remittance_settlements
		WHERE tenant_id = ? AND created_at >= date('now', ?)
		GROUP BY DATE(created_at)
		ORDER BY date DESC
		LIMIT ?
	`

	var results []struct {
		Date     string
		BuyRate  float64
		SellRate float64
	}

	// Fixed: Use fmt.Sprintf instead of string(rune(days)) which produces wrong output
	daysParam := fmt.Sprintf("-%d days", days)
	s.db.Raw(query, tenantID, daysParam, days).Scan(&results)

	for _, r := range results {
		trends = append(trends, RateTrend{
			Date:     r.Date,
			BuyRate:  r.BuyRate,
			SellRate: r.SellRate,
			Spread:   r.BuyRate - r.SellRate,
		})
	}

	return trends
}

type DailyProfit struct {
	Date   string  `json:"date"`
	Profit float64 `json:"profit"`
}

func (s *DashboardService) getDailyProfit(tenantID uint, days int) []DailyProfit {
	var results []DailyProfit

	s.db.Model(&models.RemittanceSettlement{}).
		Select("DATE(created_at) as date, COALESCE(SUM(profit_cad), 0) as profit").
		Where("tenant_id = ? AND created_at >= date('now', ?)", tenantID, fmt.Sprintf("-%d days", days)).
		Group("DATE(created_at)").
		Order("date DESC").
		Limit(days).
		Scan(&results)

	return results
}

func (s *DashboardService) getClientCount(tenantID uint) int {
	var count int64
	s.db.Model(&models.Client{}).Where("tenant_id = ?", tenantID).Count(&count)
	return int(count)
}

func (s *DashboardService) getActiveRemittanceCount(tenantID uint) int {
	var count int64
	s.db.Model(&models.OutgoingRemittance{}).
		Where("tenant_id = ? AND status IN (?, ?)", tenantID, models.RemittanceStatusPending, models.RemittanceStatusPartial).
		Count(&count)
	return int(count)
}

func (s *DashboardService) getPendingPickupCount(tenantID uint) int {
	var count int64
	s.db.Model(&models.PickupTransaction{}).
		Where("tenant_id = ? AND status = ?", tenantID, "PENDING").
		Count(&count)
	return int(count)
}

func (s *DashboardService) generateAlerts(tenantID uint, branchID *uint, dashboard *DashboardData) []Alert {
	alerts := make([]Alert, 0)

	// Alert for old debts
	for _, aging := range dashboard.DebtAging {
		if aging.IsCritical && aging.Count > 0 {
			alerts = append(alerts, Alert{
				Type:    "error",
				Title:   "Critical: Old Debts",
				Message: fmt.Sprintf("You have %d remittances outstanding for over 30 days", aging.Count),
				Link:    "/remittances/outgoing?status=PENDING&age=30",
			})
		} else if aging.IsWarning && aging.Count > 0 {
			alerts = append(alerts, Alert{
				Type:    "warning",
				Title:   "Aging Debts",
				Message: fmt.Sprintf("You have %d remittances outstanding for 15-30 days", aging.Count),
				Link:    "/remittances/outgoing?status=PENDING&age=15",
			})
		}
	}

	// Alert for pending incoming that can be settled
	if dashboard.IncomingSummary.PendingCount > 0 && dashboard.OutgoingSummary.PendingCount > 0 {
		alerts = append(alerts, Alert{
			Type:    "info",
			Title:   "Settlement Available",
			Message: "You have incoming remittances that can be used to settle outstanding debts",
			Link:    "/remittances/settle",
		})
	}

	// Low cash balance alert (example threshold)
	for _, balance := range dashboard.CashBalances {
		if balance.Currency == "CAD" && balance.Balance < 1000 {
			alerts = append(alerts, Alert{
				Type:    "warning",
				Title:   "Low Cash Balance",
				Message: "CAD cash balance is below $1,000",
				Link:    "/cash-balances",
			})
		}
	}

	// Pending pickups
	if dashboard.PendingPickupsCount > 0 {
		alerts = append(alerts, Alert{
			Type:    "info",
			Title:   "Pending Pickups",
			Message: fmt.Sprintf("You have %d pending pickup transactions", dashboard.PendingPickupsCount),
			Link:    "/pickups?status=PENDING",
		})
	}

	return alerts
}
