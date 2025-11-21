import { Branch } from './branch.model';
import { User } from './user.model';

export interface Payment {
    id: number;
    tenantId: number;
    transactionId: string;
    branchId?: number;
    
    // Payment Details
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBase: number; // Converted to transaction's base currency
    
    // Payment Method
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'ONLINE' | 'OTHER';
    
    // Tracking
    paidBy: number;
    notes?: string;
    receiptNumber?: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    
    // Timestamps
    paidAt: string;
    createdAt: string;
    updatedAt: string;
    
    // Edit History
    isEdited: boolean;
    editedAt?: string;
    editedBy?: number;
    editReason?: string;
    
    // Cancellation
    cancelledAt?: string;
    cancelledBy?: number;
    cancelReason?: string;
    
    // Relations (loaded when needed)
    branch?: Branch;
    paidByUser?: User;
    editedByUser?: User;
    cancelledByUser?: User;
}

export interface CreatePaymentRequest {
    amount: number;
    currency: string;
    exchangeRate: number;
    paymentMethod: string;
    notes?: string;
    receiptNumber?: string;
    branchId?: number;
}

export interface UpdatePaymentRequest {
    amount?: number;
    currency?: string;
    exchangeRate?: number;
    paymentMethod?: string;
    notes?: string;
    receiptNumber?: string;
    editReason: string;
}

export interface CancelPaymentRequest {
    reason: string;
}

export const PAYMENT_METHODS = [
    { value: 'CASH', label: '💵 Cash' },
    { value: 'BANK_TRANSFER', label: '🏦 Bank Transfer' },
    { value: 'CARD', label: '💳 Card' },
    { value: 'CHEQUE', label: '📝 Cheque' },
    { value: 'ONLINE', label: '🌐 Online' },
    { value: 'OTHER', label: '📋 Other' },
] as const;

export const PAYMENT_STATUS_LABELS: Record<Payment['status'], { label: string; color: string }> = {
    PENDING: { label: 'Pending', color: 'yellow' },
    COMPLETED: { label: 'Completed', color: 'green' },
    FAILED: { label: 'Failed', color: 'red' },
    CANCELLED: { label: 'Cancelled', color: 'gray' },
};
