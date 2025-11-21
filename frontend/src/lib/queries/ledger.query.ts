import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../axios-config';
import type {
    LedgerEntry,
    CreateLedgerEntryRequest,
    ExchangeRequest,
    LedgerBalance,
} from '../models/ledger.model';

// ==================== Ledger Queries ====================

export function useGetClientBalances(clientId: string) {
    return useQuery<LedgerBalance>({
        queryKey: ['ledger-balances', clientId],
        queryFn: async () => {
            const response = await axiosInstance.get(`/clients/${clientId}/ledger/balance`);
            return response.data;
        },
        enabled: !!clientId,
    });
}

export function useGetClientEntries(clientId: string, limit = 50, offset = 0) {
    return useQuery<LedgerEntry[]>({
        queryKey: ['ledger-entries', clientId, limit, offset],
        queryFn: async () => {
            const response = await axiosInstance.get(`/clients/${clientId}/ledger/entries`, {
                params: { limit, offset },
            });
            return response.data;
        },
        enabled: !!clientId,
    });
}

// ==================== Ledger Mutations ====================

export function useAddLedgerEntry(clientId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateLedgerEntryRequest) => {
            const response = await axiosInstance.post(`/clients/${clientId}/ledger/entry`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ledger-balances', clientId] });
            queryClient.invalidateQueries({ queryKey: ['ledger-entries', clientId] });
        },
    });
}

export function useExchangeCurrency(clientId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ExchangeRequest) => {
            const response = await axiosInstance.post(`/clients/${clientId}/ledger/exchange`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ledger-balances', clientId] });
            queryClient.invalidateQueries({ queryKey: ['ledger-entries', clientId] });
        },
    });
}
