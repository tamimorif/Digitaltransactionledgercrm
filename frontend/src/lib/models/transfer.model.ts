import { Branch } from './branch.model';
import { User } from './auth.model';

export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export interface Transfer {
    id: number;
    createdAt: string;
    updatedAt: string;
    tenantId: number;
    sourceBranchId: number;
    sourceBranch?: Branch;
    destinationBranchId: number;
    destinationBranch?: Branch;
    amount: number;
    currency: string;
    status: TransferStatus;
    description: string;
    createdById: number;
    createdBy?: User;
    acceptedById?: number;
    acceptedBy?: User;
    acceptedAt?: string;
}

export interface CreateTransferRequest {
    sourceBranchId: number;
    destinationBranchId: number;
    amount: number;
    currency: string;
    description: string;
}
