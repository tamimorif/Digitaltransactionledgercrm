import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAllBalances,
    getBalanceByCurrency,
    refreshBalance,
    refreshAllBalances,
    createAdjustment,
    getAdjustmentHistory,
    getActiveCurrencies,
} from '../cash-balance-api';
import { CreateAdjustmentRequest } from '../models/cash-balance.model';

// Get all balances
export const useGetAllBalances = (branchId?: number) => {
    return useQuery({
        queryKey: ['cashBalances', branchId],
        queryFn: () => getAllBalances(branchId),
    });
};

// Get balance by currency
export const useGetBalanceByCurrency = (currency: string, branchId?: number) => {
    return useQuery({
        queryKey: ['cashBalance', currency, branchId],
        queryFn: () => getBalanceByCurrency(currency, branchId),
        enabled: !!currency,
    });
};

// Get active currencies
export const useGetActiveCurrencies = (branchId?: number) => {
    return useQuery({
        queryKey: ['activeCurrencies', branchId],
        queryFn: () => getActiveCurrencies(branchId),
    });
};

// Get adjustment history
export const useGetAdjustmentHistory = (
    branchId?: number,
    currency?: string,
    page = 1,
    limit = 20
) => {
    return useQuery({
        queryKey: ['adjustmentHistory', branchId, currency, page, limit],
        queryFn: () => getAdjustmentHistory(branchId, currency, page, limit),
    });
};

// Refresh balance
export const useRefreshBalance = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => refreshBalance(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashBalances'] });
            queryClient.invalidateQueries({ queryKey: ['cashBalance'] });
        },
    });
};

// Refresh all balances
export const useRefreshAllBalances = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: refreshAllBalances,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashBalances'] });
            queryClient.invalidateQueries({ queryKey: ['cashBalance'] });
        },
    });
};

// Create adjustment
export const useCreateAdjustment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateAdjustmentRequest) => createAdjustment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashBalances'] });
            queryClient.invalidateQueries({ queryKey: ['cashBalance'] });
            queryClient.invalidateQueries({ queryKey: ['adjustmentHistory'] });
        },
    });
};
