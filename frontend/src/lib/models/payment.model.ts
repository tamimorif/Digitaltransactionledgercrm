export interface Payment {
    id: number;
    tenantId: number;
    transactionId: string;
    branchId?: number;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBase: number;
    paymentMethod: string;
    paidBy: number;
    notes?: string;
    receiptNumber?: string;
    status: string;
    paidAt: string;
    createdAt: string;
    updatedAt: string;
    isEdited: boolean;
    editedAt?: string;
    editedBy?: number;
    editReason?: string;
    cancelledAt?: string;
    cancelledBy?: number;
    cancelReason?: string;

    // Relations
    branch?: {
        id: number;
        name: string;
    };
    paidByUser?: {
        id: number;
        email: string;
        name?: string;
    };
}

export interface CreatePaymentRequest {
    amount: number;
    currency: string;
    exchangeRate: number;
    paymentMethod: string;
    notes?: string;
    receiptNumber?: string;
    transactionId: string;
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
    { value: 'CASH', label: 'Cash' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'POS', label: 'POS Terminal' },
];

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    SINGLE: { label: 'Single Payment', color: 'default' },
    OPEN: { label: 'Open Credit', color: 'secondary' },
    PARTIAL: { label: 'Partially Paid', color: 'outline' },
    FULLY_PAID: { label: 'Fully Paid', color: 'default' },
};
