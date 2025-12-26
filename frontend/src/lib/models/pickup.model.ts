/**
 * Disbursement/Pickup Models
 * 
 * TERMINOLOGY UPDATE:
 * - "Pickup" → "Disbursement" (professional banking term)
 * - "pickupCode" → "controlNumber" (Remittance Control Number)
 * - "pickedUp" → "disbursed" (funds released)
 * 
 * Note: Internal field names are kept for backward compatibility.
 * Use the new type aliases (Disbursement, etc.) in new code.
 */

// Disbursement Type (professional term for transaction method)
export type DisbursementType =
    | 'CASH_PAYOUT'      // Cash pickup at branch (new)
    | 'BANK_TRANSFER'    // Wire to bank account  
    | 'FX_CONVERSION'    // Currency exchange (new)
    | 'CARD_CREDIT'      // Credit to card (new)
    | 'INCOMING_FUNDS'   // Recording received funds
    // Legacy types (still valid, mapped from old records)
    | 'CASH_PICKUP'
    | 'CASH_EXCHANGE'
    | 'CARD_SWAP_IRR';

// Legacy type alias
export type TransactionType = DisbursementType;

// Disbursement Status
export type DisbursementStatus = 'PENDING' | 'DISBURSED' | 'CANCELLED' | 'PICKED_UP';
export type PickupStatus = DisbursementStatus;

/**
 * Disbursement (formerly PickupTransaction)
 * Represents a money transfer/payout between branches.
 */
export interface Disbursement {
    id: number;
    transactionId?: string;
    tenantId: number;

    /** Remittance Control Number (RCN) - unique tracking code */
    pickupCode: string;

    senderBranchId: number;
    receiverBranchId: number;

    // Sender Details
    senderName: string;
    senderPhone: string;

    // Recipient/Beneficiary Details
    recipientName: string;
    recipientPhone?: string;
    recipientIban?: string;

    /** Disbursement method */
    transactionType: DisbursementType;

    // Amount Details
    amount: number;
    currency: string;
    receiverCurrency?: string;
    receiverAmount?: number;
    exchangeRate?: number;
    fees?: number;

    status: DisbursementStatus;

    // Disbursement completion
    pickedUpAt?: string;
    pickedUpByUserId?: number;

    // Cancellation
    cancelledAt?: string;
    cancelledByUserId?: number;
    cancellationReason?: string;

    // Edit Tracking
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
    payments?: unknown[];

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

/** @deprecated Use Disbursement instead */
export type PickupTransaction = Disbursement;

export interface CreateDisbursementRequest {
    transactionId?: string;
    senderBranchId: number;
    receiverBranchId: number;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone?: string;
    recipientIban?: string;
    transactionType: DisbursementType;
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

/** @deprecated Use CreateDisbursementRequest instead */
export type CreatePickupTransactionRequest = CreateDisbursementRequest;

export interface EditDisbursementRequest {
    amount: number;
    currency: string;
    receiverCurrency?: string;
    exchangeRate?: number;
    receiverAmount?: number;
    fees: number;
    allowPartialPayment?: boolean;
    editReason: string;
}

/** @deprecated Use EditDisbursementRequest instead */
export type EditPickupTransactionRequest = EditDisbursementRequest;

export interface DisbursementsResponse {
    data: Disbursement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/** @deprecated Use DisbursementsResponse instead */
export type PickupTransactionsResponse = DisbursementsResponse;
