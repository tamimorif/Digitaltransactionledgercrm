import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../axios-config';

export interface DailyReconciliation {
    id: number;
    tenantId: number;
    branchId: number;
    date: string;
    openingBalance: number;
    closingBalance: number;
    expectedBalance: number;
    variance: number;
    currencyBreakdown?: string;
    notes?: string;
    createdByUserId: number;
    createdAt: string;
    updatedAt: string;
    branch?: {
        id: number;
        name: string;
    };
    createdBy?: {
        id: number;
        username: string;
    };
}

export interface ExpectedBalanceBreakdown {
    currency: string;
    cash: number;
    bank: number;
    total: number;
}

/**
 * Hook to create a new reconciliation record
 */
export const useCreateReconciliation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            branchId: number;
            date: string;
            openingBalance: number;
            closingBalance: number;
            currencyBreakdown?: Record<string, number>;
            notes?: string;
        }) => {
            const response = await apiClient.post('/reconciliation', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
        },
    });
};

/**
 * Hook to get reconciliation history
 */
export const useGetReconciliationHistory = (branchId?: number, startDate?: string, endDate?: string) => {
    return useQuery({
        queryKey: ['reconciliations', branchId, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (branchId) params.append('branchId', branchId.toString());
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await apiClient.get<DailyReconciliation[]>(`/reconciliation?${params.toString()}`);
            return response.data;
        },
    });
};

/**
 * Hook to get variance report
 */
export const useGetVarianceReport = () => {
    return useQuery({
        queryKey: ['reconciliationVariance'],
        queryFn: async () => {
            const response = await apiClient.get<DailyReconciliation[]>('/reconciliation/variance');
            return response.data;
        },
    });
};

/**
 * Hook to get system state (expected balances) for a branch
 */
export const useGetSystemState = (branchId?: number) => {
    return useQuery({
        queryKey: ['reconciliationSystemState', branchId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (branchId) params.append('branchId', branchId.toString());
            const response = await apiClient.get<ExpectedBalanceBreakdown[]>(
                `/reconciliation/system-state?${params.toString()}`
            );
            return response.data;
        },
        enabled: !!branchId,
    });
};
