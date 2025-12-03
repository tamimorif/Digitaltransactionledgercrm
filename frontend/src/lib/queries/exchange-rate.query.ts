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

export interface ScrapedRate {
    currency: string;
    currency_fa: string;
    buy_rate: string;
    sell_rate: string;
    buy_rate_formatted: string;
    sell_rate_formatted: string;
    is_available: boolean;
    scraped_at: string;
}

export interface ScrapedRatesResponse {
    success: boolean;
    source: string;
    rates: ScrapedRate[];
    refreshed?: boolean;
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
 * Hook to get scraped rates from sarafibahmani.ca (public endpoint, no auth)
 */
export const useGetScrapedRates = () => {
    return useQuery({
        queryKey: ['scrapedRates'],
        queryFn: async () => {
            // Use fetch directly since this is a public endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rates/scraped`);
            if (!response.ok) {
                throw new Error('Failed to fetch scraped rates');
            }
            const data: ScrapedRatesResponse = await response.json();
            return data;
        },
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
        staleTime: 4 * 60 * 1000, // Consider stale after 4 minutes
    });
};

/**
 * Hook to refresh scraped rates
 */
export const useRefreshScrapedRates = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rates/scraped/refresh`, {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error('Failed to refresh scraped rates');
            }
            const data: ScrapedRatesResponse = await response.json();
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scrapedRates'] });
        },
    });
};

/**
 * Hook to get CAD to IRR rate specifically
 */
export const useGetCADToIRRRate = () => {
    return useQuery({
        queryKey: ['cadToIrrRate'],
        queryFn: async () => {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rates/cad-irr`);
            if (!response.ok) {
                throw new Error('Failed to fetch CAD-IRR rate');
            }
            return response.json();
        },
        refetchInterval: 5 * 60 * 1000,
        staleTime: 4 * 60 * 1000,
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
