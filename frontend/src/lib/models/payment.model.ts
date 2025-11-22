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
}
