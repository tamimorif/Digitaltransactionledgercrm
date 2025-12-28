import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/src/lib/dashboard-api';
import { DashboardSummary } from '@/src/lib/models/dashboard.model';

export const useDashboardData = (branchId?: number, enabled: boolean = true) => {
    return useQuery<DashboardSummary>({
        queryKey: ['dashboard-summary', branchId],
        queryFn: () => getDashboardSummary(branchId),
        enabled,
        refetchInterval: 60000, // Refresh every 60 seconds
    });
};
