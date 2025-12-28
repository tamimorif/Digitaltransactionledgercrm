// Dashboard Models

export interface RemittanceSummary {
    pendingCount: number;
    partialCount: number;
    totalPendingCad: number;
    totalRemainingIrr: number;
}

export interface CashBalanceSummary {
    currency: string;
    balance: number;
}

export interface DailyMetrics {
    transactionCount: number;
    transactionVolume: number;
    newCustomers: number;
    profitCad: number;
}

export interface DebtAging {
    bucket: string;
    count: number;
    totalIrr: number;
    totalCad: number;
    isWarning: boolean;
    isCritical: boolean;
}

export interface RateTrend {
    date: string;
    currency: string;
    buyRate: number;
    sellRate: number;
    spread: number;
}

export interface DailyProfit {
    date: string;
    profit: number;
}

export interface DailyVolume {
    date: string;
    income: number;
    outgoing: number;
}

export interface DashboardAlert {
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    entityId?: number;
    link?: string;
}

export interface DashboardData {
    outgoingSummary: RemittanceSummary;
    incomingSummary: RemittanceSummary;
    cashBalances: CashBalanceSummary[];
    todayMetrics: DailyMetrics;
    weekMetrics: DailyMetrics;
    monthMetrics: DailyMetrics;
    debtAging: DebtAging[];
    rateTrends: RateTrend[];
    dailyProfit: DailyProfit[];
    dailyVolumes: DailyVolume[];
    alerts: DashboardAlert[];
    totalClientsCount: number;
    activeRemittancesCount: number;
    pendingPickupsCount: number;
    lastUpdated: string;
}

// Auto-Settlement Models

export interface SettlementSuggestion {
    outgoingId: number;
    outgoingCode: string;
    senderName: string;
    outgoingAmount: number;
    remainingAmount: number;
    suggestedAmount: number;
    buyRate: number;
    sellRate: number;
    estimatedProfit: number;
    createdAt: string;
    priority: number;
}

export interface AutoSettlementResult {
    settledCount: number;
    totalAmountIRR: number;
    totalProfitCAD: number;
    settlements: SettlementInfo[];
}

export interface SettlementInfo {
    outgoingId: number;
    outgoingCode: string;
    settledAmount: number;
    profit: number;
}

export interface UnsettledSummary {
    totalOutgoings: number;
    totalIncomings: number;
    outgoingAmountIRR: number;
    incomingAmountIRR: number;
    netPositionIRR: number;
}

// Profit Analysis Models

export interface ProfitAnalysis {
    totalProfitCAD: number;
    totalSettlements: number;
    averageProfitPerSettlement: number;
    profitByDirection: {
        outgoing: number;
        incoming: number;
    };
    topProfitableCurrencies: CurrencyProfit[];
}

export interface CurrencyProfit {
    currency: string;
    profit: number;
    count: number;
}

export interface BranchProfit {
    branchId: number;
    branchName: string;
    totalProfit: number;
    settlementCount: number;
    averageProfit: number;
}

export interface ProfitPeriod {
    period: string;
    totalProfitCAD: number;
    settlementCount: number;
    averageProfit: number;
}

export interface CustomerProfit {
    customerId: number;
    customerName: string;
    totalProfit: number;
    transactionCount: number;
    averageProfit: number;
}

export interface ProfitFilters {
    startDate?: string;
    endDate?: string;
    branchId?: number;
    groupBy?: 'day' | 'week' | 'month';
}

// Dashboard Summary Models (Compact Endpoint)

export interface DashboardSummaryKpis {
    totalVolumeToday: number;
    profitToday: number;
    pendingRemittances: number;
    incomingPending: number;
}

export interface DashboardSummaryCashFlowPoint {
    date: string;
    in: number;
    out: number;
}

export interface DashboardSummaryRecentTransaction {
    id: string;
    client: string;
    amount: number;
    currency: string;
    createdAt: string;
}

export interface DashboardSummary {
    kpis: DashboardSummaryKpis;
    cashFlow: DashboardSummaryCashFlowPoint[];
    recentTransactions: DashboardSummaryRecentTransaction[];
}
