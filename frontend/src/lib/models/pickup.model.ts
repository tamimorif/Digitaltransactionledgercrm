// Pickup Transaction Models
export type TransactionType = 'CASH_PICKUP' | 'CASH_EXCHANGE' | 'BANK_TRANSFER' | 'CARD_SWAP_IRR' | 'INCOMING_FUNDS';

export interface PickupTransaction {
    id: number;
    transactionId?: string;
    tenantId: number;
    pickupCode: string;
    senderBranchId: number;
    receiverBranchId: number;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone?: string;  // Optional for bank transfers
    recipientIban?: string;   // For bank transfers
    transactionType: TransactionType;
    amount: number;
    currency: string;
    receiverCurrency?: string;
    receiverAmount?: number;
    exchangeRate?: number;
    fees?: number;
    status: 'PENDING' | 'PICKED_UP' | 'CANCELLED';
    pickedUpAt?: string;
    pickedUpByUserId?: number;
    cancelledAt?: string;
    cancelledByUserId?: number;
    cancellationReason?: string;
    editedAt?: string;
    editedByUserId?: number;
    editedByBranchId?: number;
    editReason?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    // Payment fields
    allowPartialPayment?: boolean;
    totalReceived?: number;
    receivedCurrency?: string;
    totalPaid?: number;
    remainingBalance?: number;
    paymentStatus?: 'SINGLE' | 'OPEN' | 'PARTIAL' | 'FULLY_PAID';
    payments?: any[];

    // Relations
    senderBranch?: {
        id: number;
        name: string;
        branchCode: string;
    };
    receiverBranch?: {
        id: number;
        name: string;
        branchCode: string;
    };
    editedByUser?: {
        id: number;
        email: string;
    };
    editedByBranch?: {
        id: number;
        name: string;
        branchCode: string;
    };
    pickedUpByUser?: {
        id: number;
        fullName: string;
    };
    cancelledByUser?: {
        id: number;
        fullName: string;
    };
}

export interface CreatePickupTransactionRequest {
    transactionId?: string;
    senderBranchId: number;
    receiverBranchId: number;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone?: string;   // Optional for bank transfers
    recipientIban?: string;    // For bank transfers
    transactionType: TransactionType;
    amount: number;
    currency: string;
    receiverCurrency?: string;
    exchangeRate?: number;
    receiverAmount?: number;
    fees: number;
    notes?: string;
    allowPartialPayment?: boolean;
    totalReceived?: number;
    receivedCurrency?: string;
}

export interface EditPickupTransactionRequest {
    amount: number;
    currency: string;
    receiverCurrency?: string;
    exchangeRate?: number;
    receiverAmount?: number;
    fees: number;
    allowPartialPayment?: boolean;
    editReason: string;
}

export interface PickupTransactionsResponse {
    data: PickupTransaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type PickupStatus = 'PENDING' | 'PICKED_UP' | 'CANCELLED';
