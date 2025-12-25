import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDashboardData,
    getDebtAging,
    getRateTrends,
    getCashOnHand,
    getSettlementSuggestions,
    autoSettle,
    executeSettlement,
    getUnsettledSummary,
    getProfitAnalysis,
    getProfitByBranch,
    getProfitTrend,
    getTopCustomers,
    downloadOutgoingReceipt,
    downloadIncomingReceipt,
    downloadBlobAsFile,
} from '../dashboard-api';
import { ProfitFilters } from '../models/dashboard.model';

// ============ Dashboard Hooks ============

/**
 * Hook to get comprehensive dashboard data
 */
export const useGetDashboardData = (branchId?: number) => {
    return useQuery({
        queryKey: ['dashboard', branchId],
        queryFn: () => getDashboardData(branchId),
        refetchInterval: 30000, // Refresh every 30 seconds
        staleTime: 10000, // Consider data stale after 10 seconds
    });
};

/**
 * Hook to get debt aging report
 */
export const useGetDebtAging = (branchId?: number) => {
    return useQuery({
        queryKey: ['dashboard', 'debt-aging', branchId],
        queryFn: () => getDebtAging(branchId),
    });
};

/**
 * Hook to get rate trends
 */
export const useGetRateTrends = (days: number = 7) => {
    return useQuery({
        queryKey: ['dashboard', 'rate-trends', days],
        queryFn: () => getRateTrends(days),
    });
};

/**
 * Hook to get cash on hand
 */
export const useGetCashOnHand = (branchId?: number) => {
    return useQuery({
        queryKey: ['dashboard', 'cash-on-hand', branchId],
        queryFn: () => getCashOnHand(branchId),
    });
};

// ============ Auto-Settlement Hooks ============

/**
 * Hook to get settlement suggestions
 */
export const useGetSettlementSuggestions = (
    incomingId: number,
    strategy: 'fifo' | 'best_rate' = 'fifo',
    enabled: boolean = true
) => {
    return useQuery({
        queryKey: ['auto-settlement', 'suggestions', incomingId, strategy],
        queryFn: () => getSettlementSuggestions(incomingId, strategy),
        enabled: enabled && incomingId > 0,
    });
};

/**
 * Hook to auto-settle incoming remittance
 */
export const useAutoSettle = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (incomingId: number) => autoSettle(incomingId),
        onSuccess: () => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['auto-settlement'] });
            queryClient.invalidateQueries({ queryKey: ['remittances'] });
        },
    });
};

/**
 * Hook to execute a specific settlement
 */
export const useExecuteSettlement = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            outgoingId,
            incomingId,
            amount,
        }: {
            outgoingId: number;
            incomingId: number;
            amount: number;
        }) => executeSettlement(outgoingId, incomingId, amount),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['auto-settlement'] });
            queryClient.invalidateQueries({ queryKey: ['remittances'] });
        },
    });
};

/**
 * Hook to get unsettled summary
 */
export const useGetUnsettledSummary = () => {
    return useQuery({
        queryKey: ['auto-settlement', 'unsettled-summary'],
        queryFn: getUnsettledSummary,
        refetchInterval: 60000, // Refresh every minute
    });
};

// ============ Profit Analysis Hooks ============

/**
 * Hook to get profit analysis
 */
export const useGetProfitAnalysis = (filters?: ProfitFilters) => {
    return useQuery({
        queryKey: ['profit-analysis', filters],
        queryFn: () => getProfitAnalysis(filters),
    });
};

/**
 * Hook to get profit by branch
 */
export const useGetProfitByBranch = (filters?: ProfitFilters) => {
    return useQuery({
        queryKey: ['profit-analysis', 'by-branch', filters],
        queryFn: () => getProfitByBranch(filters),
    });
};

/**
 * Hook to get profit trend
 */
export const useGetProfitTrend = (
    groupBy: 'day' | 'week' | 'month' = 'day',
    filters?: ProfitFilters
) => {
    return useQuery({
        queryKey: ['profit-analysis', 'trend', groupBy, filters],
        queryFn: () => getProfitTrend(groupBy, filters),
    });
};

/**
 * Hook to get top customers by profit
 */
export const useGetTopCustomers = (limit: number = 10, filters?: ProfitFilters) => {
    return useQuery({
        queryKey: ['profit-analysis', 'top-customers', limit, filters],
        queryFn: () => getTopCustomers(limit, filters),
    });
};

// ============ Receipt Hooks ============

/**
 * Hook to download outgoing remittance receipt
 */
export const useDownloadOutgoingReceipt = () => {
    return useMutation({
        mutationFn: (remittanceId: string | number) => downloadOutgoingReceipt(remittanceId),
        onSuccess: (blob, remittanceId) => {

            const filename = `outgoing_receipt_${remittanceId}_${new Date().toISOString().split('T')[0]}.pdf`;
            downloadBlobAsFile(blob, filename);
        },
    });
};

/**
 * Hook to download incoming remittance receipt
 */
export const useDownloadIncomingReceipt = () => {
    return useMutation({
        mutationFn: (remittanceId: string | number) => downloadIncomingReceipt(remittanceId),
        onSuccess: (blob, remittanceId) => {

            const filename = `incoming_receipt_${remittanceId}_${new Date().toISOString().split('T')[0]}.pdf`;
            downloadBlobAsFile(blob, filename);
        },
    });
};
