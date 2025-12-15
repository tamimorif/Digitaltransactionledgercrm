import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createPickupTransaction,
    getPickupTransactions,
    getPickupTransaction,
    searchPickupByCode,
    markAsPickedUp,
    cancelPickupTransaction,
    getPendingPickupsCount,
} from '../pickup-api';
import { CreatePickupTransactionRequest, PickupStatus } from '../models/pickup.model';

// Get pickup transactions
export const useGetPickupTransactions = (
    branchId?: number,
    status?: PickupStatus,
    page = 1,
    limit = 20
) => {
    return useQuery({
        queryKey: ['pickupTransactions', branchId, status, page, limit],
        queryFn: () => getPickupTransactions(branchId, status, page, limit),
    });
};

// Get single pickup transaction
export const useGetPickupTransaction = (id: number) => {
    return useQuery({
        queryKey: ['pickupTransaction', id],
        queryFn: () => getPickupTransaction(id),
        enabled: !!id,
    });
};

// Search pickup by code
export const useSearchPickupByCode = (code: string) => {
    return useQuery({
        queryKey: ['pickupSearch', code],
        queryFn: () => searchPickupByCode(code),
        enabled: !!code && code.length >= 5, // Support both old (6 digits) and new format (A-1234 = 6 chars)
    });
};

// Get pending pickups count
export const useGetPendingPickupsCount = (branchId?: number) => {
    return useQuery({
        queryKey: ['pendingPickupsCount', branchId],
        queryFn: () => branchId ? getPendingPickupsCount(branchId) : Promise.resolve({ count: 0 }),
        enabled: !!branchId,
    });
};

// Create pickup transaction
export const useCreatePickupTransaction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreatePickupTransactionRequest) => createPickupTransaction(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pickupTransactions'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPickupsCount'] });
        },
    });
};

// Mark as picked up
export const useMarkAsPickedUp = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => markAsPickedUp(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pickupTransactions'] });
            queryClient.invalidateQueries({ queryKey: ['pickupTransaction'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPickupsCount'] });
        },
    });
};

// Cancel pickup transaction
export const useCancelPickupTransaction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) =>
            cancelPickupTransaction(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pickupTransactions'] });
            queryClient.invalidateQueries({ queryKey: ['pickupTransaction'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPickupsCount'] });
        },
    });
};
