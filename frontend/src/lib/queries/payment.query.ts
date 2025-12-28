import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    createPayment,
    getPayments,
    getPayment,
    updatePayment,
    deletePayment,
    cancelPayment,
    completeTransaction,
} from '../payment-api';
import { getErrorMessage } from '../error';
import type {
    Payment,
    CreatePaymentRequest,
    UpdatePaymentRequest,
    CancelPaymentRequest,
} from '../models/payment.model';

// ==================== Query Keys ====================

export const paymentKeys = {
    all: ['payments'] as const,
    lists: () => [...paymentKeys.all, 'list'] as const,
    list: (transactionId: string) => [...paymentKeys.lists(), transactionId] as const,
    details: () => [...paymentKeys.all, 'detail'] as const,
    detail: (id: number) => [...paymentKeys.details(), id] as const,
};

// ==================== Queries ====================

/**
 * Get all payments for a transaction
 */
export function usePayments(transactionId: string) {
    return useQuery<Payment[]>({
        queryKey: paymentKeys.list(transactionId),
        queryFn: () => getPayments(transactionId),
        enabled: !!transactionId,
    });
}

/**
 * Get a single payment by ID
 */
export function usePayment(paymentId: number) {
    return useQuery<Payment>({
        queryKey: paymentKeys.detail(paymentId),
        queryFn: () => getPayment(paymentId),
        enabled: !!paymentId,
    });
}

// ==================== Mutations ====================

/**
 * Create a new payment
 */
export function useCreatePayment(transactionId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreatePaymentRequest) => createPayment(transactionId, data),
        onSuccess: (response) => {
            toast.success(response.message || 'Payment added successfully');
            
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: paymentKeys.list(transactionId) });
            queryClient.invalidateQueries({ queryKey: ['transactions', transactionId] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to add payment'));
        },
    });
}

/**
 * Update a payment
 */
export function useUpdatePayment(transactionId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ paymentId, data }: { paymentId: number; data: UpdatePaymentRequest }) =>
            updatePayment(paymentId, data),
        onSuccess: (response, variables) => {
            toast.success(response.message || 'Payment updated successfully');
            
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: paymentKeys.list(transactionId) });
            queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.paymentId) });
            queryClient.invalidateQueries({ queryKey: ['transactions', transactionId] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to update payment'));
        },
    });
}

/**
 * Delete a payment
 */
export function useDeletePayment(transactionId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (paymentId: number) => deletePayment(paymentId),
        onSuccess: (response) => {
            toast.success(response.message || 'Payment deleted successfully');
            
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: paymentKeys.list(transactionId) });
            queryClient.invalidateQueries({ queryKey: ['transactions', transactionId] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to delete payment'));
        },
    });
}

/**
 * Cancel a payment
 */
export function useCancelPayment(transactionId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ paymentId, data }: { paymentId: number; data: CancelPaymentRequest }) =>
            cancelPayment(paymentId, data),
        onSuccess: (response) => {
            toast.success(response.message || 'Payment cancelled successfully');
            
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: paymentKeys.list(transactionId) });
            queryClient.invalidateQueries({ queryKey: ['transactions', transactionId] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to cancel payment'));
        },
    });
}

/**
 * Complete a transaction
 */
export function useCompleteTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (transactionId: string) => completeTransaction(transactionId),
        onSuccess: (response, transactionId) => {
            toast.success(response.message || 'Transaction completed successfully');
            
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: paymentKeys.list(transactionId) });
            queryClient.invalidateQueries({ queryKey: ['transactions', transactionId] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to complete transaction'));
        },
    });
}
