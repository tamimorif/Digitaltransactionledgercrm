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
    AED_BUY: number;
    AED_SELL: number;
    TRY_BUY: number;
    TRY_SELL: number;
    USDT_BUY: number;
    USDT_SELL: number;
    BTC_BUY: number;
    BTC_SELL: number;
    ETH_BUY: number;
    ETH_SELL: number;
    XRP_BUY: number;
    XRP_SELL: number;
    TRX_BUY: number;
    TRX_SELL: number;
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
 * Hook to get scraped rates from ExchangeRate-API (Now Navasan)
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

            // Helper to create rate object
            const createRate = (code: string, name: string, buy: number, sell: number): ScrapedRate => ({
                currency: code,
                currency_fa: name,
                buy_rate: buy.toString(),
                sell_rate: sell.toString(),
                buy_rate_formatted: Math.round(buy).toLocaleString(),
                sell_rate_formatted: Math.round(sell).toLocaleString(),
                is_available: buy > 0,
                scraped_at: new Date().toISOString()
            });

            const rates: ScrapedRate[] = [
                createRate('USD', 'دلار آمریکا', data.USD_BUY, data.USD_SELL),
                createRate('CAD', 'دلار کانادا', data.CAD_BUY, data.CAD_SELL),
                createRate('EUR', 'یورو', data.EUR_BUY, data.EUR_SELL),
                createRate('GBP', 'پوند انگلیس', data.GBP_BUY, data.GBP_SELL),
                createRate('AED', 'درهم امارات', data.AED_BUY, data.AED_SELL),
                createRate('TRY', 'لیر ترکیه', data.TRY_BUY, data.TRY_SELL),
                createRate('USDT', 'تتر', data.USDT_BUY, data.USDT_SELL),
                createRate('BTC', 'بیت کوین', data.BTC_BUY, data.BTC_SELL),
                createRate('ETH', 'اتریوم', data.ETH_BUY, data.ETH_SELL),
                createRate('XRP', 'ریپل', data.XRP_BUY, data.XRP_SELL),
                createRate('TRX', 'ترون', data.TRX_BUY, data.TRX_SELL),
            ].filter(r => r.is_available); // Filter out zero rates

            return {
                success: true,
                source: 'Navasan API',
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
            // Updated to use the correct Navasan refresh endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/rates/navasan/refresh`, {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error('Failed to refresh scraped rates');
            }
            const data = await response.json();
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
