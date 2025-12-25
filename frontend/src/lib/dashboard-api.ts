import { apiClient } from './axios-config';
import {
    DashboardData,
    DebtAging,
    RateTrend,
    CashBalanceSummary,
    SettlementSuggestion,
    AutoSettlementResult,
    UnsettledSummary,
    ProfitAnalysis,
    BranchProfit,
    ProfitPeriod,
    CustomerProfit,
    ProfitFilters,
} from './models/dashboard.model';

// ============ Dashboard API ============

/**
 * Get comprehensive dashboard data
 */
export const getDashboardData = async (branchId?: number): Promise<DashboardData> => {
    const params = branchId ? `?branchId=${branchId}` : '';
    const response = await apiClient.get<DashboardData>(`/dashboard${params}`);
    return response.data;
};

/**
 * Get debt aging report
 */
export const getDebtAging = async (branchId?: number): Promise<DebtAging[]> => {
    const params = branchId ? `?branchId=${branchId}` : '';
    const response = await apiClient.get<DebtAging[]>(`/dashboard/debt-aging${params}`);
    return response.data;
};

/**
 * Get exchange rate trends
 */
export const getRateTrends = async (days: number = 7): Promise<RateTrend[]> => {
    const response = await apiClient.get<RateTrend[]>(`/dashboard/rate-trends?days=${days}`);
    return response.data;
};

/**
 * Get cash on hand by currency
 */
export const getCashOnHand = async (branchId?: number): Promise<CashBalanceSummary[]> => {
    const params = branchId ? `?branchId=${branchId}` : '';
    const response = await apiClient.get<CashBalanceSummary[]>(`/dashboard/cash-on-hand${params}`);
    return response.data;
};

// ============ Auto-Settlement API ============

/**
 * Get settlement suggestions for an incoming remittance
 */
export const getSettlementSuggestions = async (
    incomingId: number,
    strategy: 'fifo' | 'best_rate' = 'fifo'
): Promise<SettlementSuggestion[]> => {
    const response = await apiClient.get<SettlementSuggestion[]>(
        `/auto-settlement/suggestions?incomingId=${incomingId}&strategy=${strategy}`
    );
    return response.data;
};

/**
 * Auto-settle an incoming remittance using FIFO
 */
export const autoSettle = async (incomingId: number): Promise<AutoSettlementResult> => {
    const response = await apiClient.post<AutoSettlementResult>('/auto-settlement/auto-settle', {
        incomingId,
    });
    return response.data;
};

/**
 * Execute a specific settlement
 */
export const executeSettlement = async (
    outgoingId: number,
    incomingId: number,
    amount: number
): Promise<{ success: boolean; settlementId: number; profit: number }> => {
    const response = await apiClient.post('/auto-settlement/execute', {
        outgoingId,
        incomingId,
        amount,
    });
    return response.data;
};

/**
 * Get unsettled summary
 */
export const getUnsettledSummary = async (): Promise<UnsettledSummary> => {
    const response = await apiClient.get<UnsettledSummary>('/auto-settlement/unsettled-summary');
    return response.data;
};

// ============ Profit Analysis API ============

/**
 * Get profit analysis
 */
export const getProfitAnalysis = async (filters?: ProfitFilters): Promise<ProfitAnalysis> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId.toString());

    const response = await apiClient.get<ProfitAnalysis>(`/profit-analysis?${params.toString()}`);
    return response.data;
};

/**
 * Get profit by branch
 */
export const getProfitByBranch = async (filters?: ProfitFilters): Promise<BranchProfit[]> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await apiClient.get<BranchProfit[]>(`/profit-analysis/by-branch?${params.toString()}`);
    return response.data;
};

/**
 * Get profit trend over time
 */
export const getProfitTrend = async (
    groupBy: 'day' | 'week' | 'month' = 'day',
    filters?: ProfitFilters
): Promise<ProfitPeriod[]> => {
    const params = new URLSearchParams();
    params.append('groupBy', groupBy);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId.toString());

    const response = await apiClient.get<ProfitPeriod[]>(`/profit-analysis/trend?${params.toString()}`);
    return response.data;
};

/**
 * Get top profitable customers
 */
export const getTopCustomers = async (
    limit: number = 10,
    filters?: ProfitFilters
): Promise<CustomerProfit[]> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId.toString());

    const response = await apiClient.get<CustomerProfit[]>(`/profit-analysis/by-customer?${params.toString()}`);
    return response.data;
};

// ============ Receipt API ============

/**
 * Generate and download outgoing remittance receipt
 */
export const downloadOutgoingReceipt = async (remittanceId: string | number): Promise<Blob> => {

    const response = await apiClient.get(`/receipts/outgoing/${remittanceId}`, {
        responseType: 'blob',
    });
    return response.data;
};

/**
 * Generate and download incoming remittance receipt
 */
export const downloadIncomingReceipt = async (remittanceId: string | number): Promise<Blob> => {

    const response = await apiClient.get(`/receipts/incoming/${remittanceId}`, {
        responseType: 'blob',
    });
    return response.data;
};

/**
 * Helper to trigger download of a blob
 */
export const downloadBlobAsFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
