// Pickup Transaction Models
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
    recipientPhone: string;
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
    notes?: string;
    createdAt: string;
    updatedAt: string;

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
    recipientPhone: string;
    amount: number;
    currency: string;
    receiverCurrency?: string;
    receiverAmount?: number;
    exchangeRate?: number;
    fees: number;
    notes?: string;
}

export interface PickupTransactionsResponse {
    data: PickupTransaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type PickupStatus = 'PENDING' | 'PICKED_UP' | 'CANCELLED';
