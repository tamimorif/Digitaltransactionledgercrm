import axiosInstance from './axios-instance';
import {
    Payment,
    CreatePaymentRequest,
    UpdatePaymentRequest,
    CancelPaymentRequest,
} from './models/payment.model';
import { Transaction } from './models/client.model';

// ==================== Payment API Functions ====================

/**
 * Create a new payment for a transaction
 */
export const createPayment = async (
    transactionId: string,
    data: CreatePaymentRequest
): Promise<{ message: string; payment: Payment; transaction: Transaction }> => {
    const response = await axiosInstance.post(`/transactions/${transactionId}/payments`, data);
    return response.data;
};

/**
 * Get all payments for a transaction
 */
export const getPayments = async (transactionId: string): Promise<Payment[]> => {
    const response = await axiosInstance.get(`/transactions/${transactionId}/payments`);
    return response.data;
};

/**
 * Get a single payment by ID
 */
export const getPayment = async (paymentId: number): Promise<Payment> => {
    const response = await axiosInstance.get(`/payments/${paymentId}`);
    return response.data;
};

/**
 * Update a payment
 */
export const updatePayment = async (
    paymentId: number,
    data: UpdatePaymentRequest
): Promise<{ message: string; payment: Payment }> => {
    const response = await axiosInstance.put(`/payments/${paymentId}`, data);
    return response.data;
};

/**
 * Delete a payment
 */
export const deletePayment = async (paymentId: number): Promise<{ message: string }> => {
    const response = await axiosInstance.delete(`/payments/${paymentId}`);
    return response.data;
};

/**
 * Cancel a payment
 */
export const cancelPayment = async (
    paymentId: number,
    data: CancelPaymentRequest
): Promise<{ message: string }> => {
    const response = await axiosInstance.post(`/payments/${paymentId}/cancel`, data);
    return response.data;
};

/**
 * Complete a transaction (mark as fully paid)
 */
export const completeTransaction = async (
    transactionId: string
): Promise<{ message: string; transaction: Transaction }> => {
    const response = await axiosInstance.post(`/transactions/${transactionId}/complete`);
    return response.data;
};

// ==================== Helper Functions ====================

/**
 * Calculate payment progress percentage
 */
export const calculatePaymentProgress = (transaction: Transaction): number => {
    if (!transaction.totalReceived || transaction.totalReceived === 0) {
        return 0;
    }
    const progress = ((transaction.totalPaid || 0) / transaction.totalReceived) * 100;
    return Math.min(Math.round(progress), 100);
};

/**
 * Check if transaction can be completed
 */
export const canCompleteTransaction = (transaction: Transaction): boolean => {
    if (!transaction.allowPartialPayment) return false;
    if (transaction.paymentStatus === 'FULLY_PAID') return false;
    
    const remaining = transaction.remainingBalance || 0;
    const tolerance = (transaction.totalReceived || 0) * 0.01; // 1% tolerance
    
    return remaining <= Math.max(tolerance, 0.01);
};

/**
 * Format payment status label
 */
export const getPaymentStatusLabel = (status: Transaction['paymentStatus']): string => {
    const labels: Record<string, string> = {
        SINGLE: 'Single Payment',
        OPEN: 'Open',
        PARTIAL: 'Partially Paid',
        FULLY_PAID: 'Fully Paid',
    };
    return labels[status || 'SINGLE'] || status || 'Unknown';
};

/**
 * Get payment status color
 */
export const getPaymentStatusColor = (status: Transaction['paymentStatus']): string => {
    const colors: Record<string, string> = {
        SINGLE: 'blue',
        OPEN: 'yellow',
        PARTIAL: 'orange',
        FULLY_PAID: 'green',
    };
    return colors[status || 'SINGLE'] || 'gray';
};
