// Cash Balance Models
export interface CashBalance {
    id: number;
    tenantId: number;
    branchId?: number;
    currency: string;
    autoCalculatedBalance: number;
    manualAdjustment: number;
    finalBalance: number;
    lastCalculatedAt: string;
    lastManualAdjustmentAt?: string;
    createdAt: string;
    updatedAt: string;

    // Relations
    branch?: {
        id: number;
        name: string;
        branchCode: string;
    };
}

export interface CashAdjustment {
    id: number;
    tenantId: number;
    branchId?: number;
    currency: string;
    amount: number;
    reason: string;
    adjustedBy: number;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;

    // Relations
    branch?: {
        id: number;
        name: string;
    };
    adjustedByUser?: {
        id: number;
        fullName: string;
    };
}

export interface CreateAdjustmentRequest {
    branchId?: number;
    currency: string;
    amount: number;
    reason: string;
}

export interface AdjustmentHistoryResponse {
    data: CashAdjustment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
