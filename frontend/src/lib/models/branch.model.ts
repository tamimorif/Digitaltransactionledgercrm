// Branch Types

export interface Branch {
    id: number;
    tenantId: number;
    name: string;
    location: string;
    branchCode: string;
    isPrimary: boolean;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}

export interface CreateBranchRequest {
    name: string;
    location?: string;
}

export interface UpdateBranchRequest {
    name?: string;
    location?: string;
}

export interface UserBranch {
    userId: number;
    branchId: number;
    accessLevel: 'manager' | 'staff';
    createdAt: string;
}

export interface AssignUserRequest {
    userId: number;
    accessLevel: 'manager' | 'staff';
}
