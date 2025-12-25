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

export interface ExternalRatesResponse {
    CAD_BUY: number;
    CAD_SELL: number;
    EUR_BUY: number;
    EUR_SELL: number;
    GBP_BUY: number;
    GBP_SELL: number;
    USD_BUY: number;
    USD_SELL: number;
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
 * Hook to get scraped rates from ExchangeRate-API
 */
export const useGetScrapedRates = () => {
    return useQuery({
        queryKey: ['scrapedRates'],
        queryFn: async () => {
            // Use fetch directly since this is a public endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rates/fetch-external`);
            if (!response.ok) {
                throw new Error('Failed to fetch external rates');
            }
            const data: ExternalRatesResponse = await response.json();
            // Map the flat response to the expected structure if necessary, or just return it.
            // The previous 'ScrapedRatesResponse' had { success, source, rates[] }.
            // The new response is { CAD_BUY, ... }.
            // We need to adapt it to match the component's expectation if the component expects a list.

            // Wait, the component expects ScrapedRatesResponse = { rates: ScrapedRate[] }?
            // I need to check how the component consumes it.
            // If I change the return type here, I break the component!

            // I will adapt the response here to match the old ScrapedRatesResponse structure.

            const rates: ScrapedRate[] = [
                {
                    currency: 'CAD',
                    currency_fa: 'دلار کانادا',
                    buy_rate: data.CAD_BUY.toString(),
                    sell_rate: data.CAD_SELL.toString(),
                    buy_rate_formatted: Math.round(data.CAD_BUY).toLocaleString(),
                    sell_rate_formatted: Math.round(data.CAD_SELL).toLocaleString(),
                    is_available: true,
                    scraped_at: new Date().toISOString()
                },
                {
                    currency: 'USD',
                    currency_fa: 'دلار آمریکا',
                    buy_rate: data.USD_BUY.toString(),
                    sell_rate: data.USD_SELL.toString(),
                    buy_rate_formatted: Math.round(data.USD_BUY).toLocaleString(),
                    sell_rate_formatted: Math.round(data.USD_SELL).toLocaleString(),
                    is_available: true,
                    scraped_at: new Date().toISOString()
                },
                {
                    currency: 'EUR',
                    currency_fa: 'یورو',
                    buy_rate: data.EUR_BUY.toString(),
                    sell_rate: data.EUR_SELL.toString(),
                    buy_rate_formatted: Math.round(data.EUR_BUY).toLocaleString(),
                    sell_rate_formatted: Math.round(data.EUR_SELL).toLocaleString(),
                    is_available: true,
                    scraped_at: new Date().toISOString()
                },
                {
                    currency: 'GBP',
                    currency_fa: 'پوند انگلیس',
                    buy_rate: data.GBP_BUY.toString(),
                    sell_rate: data.GBP_SELL.toString(),
                    buy_rate_formatted: Math.round(data.GBP_BUY).toLocaleString(),
                    sell_rate_formatted: Math.round(data.GBP_SELL).toLocaleString(),
                    is_available: true,
                    scraped_at: new Date().toISOString()
                }
            ];

            return {
                success: true,
                source: 'ExchangeRate-API',
                rates: rates,
                refreshed: true
            };
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

export interface NavasanRate {
    currency: string;
    currency_fa: string;
    value: string;
    change: string;
    change_percent: string;
    updated_at: string;
    fetched_at: string;
    source: string;
}

export interface NavasanResponse {
    success: boolean;
    data: NavasanRate[];
    source: string;
    message?: string;
}

/**
 * Hook to get Navasan (Street) rates
 */
export const useGetNavasanRates = () => {
    return useQuery({
        queryKey: ['navasanRates'],
        queryFn: async () => {
            // Use public API
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rates/navasan`);
            if (!response.ok) {
                throw new Error('Failed to fetch Navasan rates');
            }
            const data: NavasanResponse = await response.json();
            return data;
        },
        refetchInterval: 5 * 60 * 1000,
    });
};
