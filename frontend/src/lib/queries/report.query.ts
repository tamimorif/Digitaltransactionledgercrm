import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../axios-config';

export interface ReportData {
    period: string;
    totalTransactions: number;
    totalVolume: Record<string, number>;
    totalRevenue: number;
    totalFees: number;
    topCustomers: CustomerSummary[];
    branchPerformance: BranchSummary[];
}

export interface CustomerSummary {
    clientId: string;
    clientName: string;
    txCount: number;
    volume: number;
}

export interface BranchSummary {
    branchId: number;
    branchName: string;
    txCount: number;
    volume: number;
    revenue: number;
}

/**
 * Hook to get daily report
 */
export const useGetDailyReport = (date?: string, branchId?: number) => {
    return useQuery({
        queryKey: ['dailyReport', date, branchId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (branchId) params.append('branchId', branchId.toString());

            const response = await apiClient.get<ReportData>(`/reports/daily?${params.toString()}`);
            return response.data;
        },
    });
};

/**
 * Hook to get monthly report
 */
export const useGetMonthlyReport = (year?: number, month?: number, branchId?: number) => {
    return useQuery({
        queryKey: ['monthlyReport', year, month, branchId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (year) params.append('year', year.toString());
            if (month) params.append('month', month.toString());
            if (branchId) params.append('branchId', branchId.toString());

            const response = await apiClient.get<ReportData>(`/reports/monthly?${params.toString()}`);
            return response.data;
        },
    });
};

/**
 * Hook to get custom report
 */
export const useGetCustomReport = (startDate?: string, endDate?: string, branchId?: number) => {
    return useQuery({
        queryKey: ['customReport', startDate, endDate, branchId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (branchId) params.append('branchId', branchId.toString());

            const response = await apiClient.get<ReportData>(`/reports/custom?${params.toString()}`);
            return response.data;
        },
        enabled: !!startDate && !!endDate,
    });
};
