import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../axios-config';

export interface ExchangeRate {
    id: number;
    tenantId: number;
    baseCurrency: string;
    targetCurrency: string;
    rate: number;
    source: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Hook to get all current exchange rates
 */
export const useGetRates = () => {
    return useQuery({
        queryKey: ['exchangeRates'],
        queryFn: async () => {
            const response = await apiClient.get<ExchangeRate[]>('/rates');
            return response.data;
        },
    });
};

/**
 * Hook to refresh rates from API
 */
export const useRefreshRates = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (baseCurrency: string = 'USD') => {
            const response = await apiClient.post('/rates/refresh', { baseCurrency });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
        },
    });
};

/**
 * Hook to set a custom exchange rate
 */
export const useSetCustomRate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { baseCurrency: string; targetCurrency: string; rate: number }) => {
            const response = await apiClient.post('/rates/manual', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
        },
    });
};

/**
 * Hook to get rate history for charting
 */
export const useGetRateHistory = (baseCurrency: string, targetCurrency: string, days: number = 30) => {
    return useQuery({
        queryKey: ['rateHistory', baseCurrency, targetCurrency, days],
        queryFn: async () => {
            const response = await apiClient.get<ExchangeRate[]>(
                `/rates/history?base=${baseCurrency}&target=${targetCurrency}&days=${days}`
            );
            return response.data;
        },
        enabled: !!baseCurrency && !!targetCurrency,
    });
};
