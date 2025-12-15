// Customer Models
export interface Customer {
    id: number;
    phone: string;
    fullName: string;
    email?: string;
    createdAt: string;
    updatedAt: string;

    // Relations (for SuperAdmin view)
    tenantLinks?: CustomerTenantLink[];
}

export interface CustomerTenantLink {
    id: number;
    customerId: number;
    tenantId: number;
    firstTransactionAt: string;
    lastTransactionAt: string;
    totalTransactions: number;
    createdAt: string;
    updatedAt: string;

    // Relations
    customer?: Customer;
    tenant?: {
        id: number;
        companyName: string;
        status: string;
    };
}

// Customer Search Result with Branch Information (SuperAdmin)
export interface CustomerBranchInfo {
    branchId: number;
    branchName: string;
}

export interface CustomerTenantInfo {
    customerId: number;
    tenantId: number;
    companyName: string;
    firstTransactionAt: string;
    lastTransactionAt: string;
    totalTransactions: number;
    branches: CustomerBranchInfo[];
}

export interface CustomerSearchResult {
    id: number;
    phone: string;
    fullName: string;
    email?: string;
    createdAt: string;
    updatedAt: string;
    tenantInfos: CustomerTenantInfo[];
}

export interface FindOrCreateCustomerRequest {
    phone: string;
    fullName: string;
    email?: string;
}

export interface UpdateCustomerRequest {
    fullName: string;
    email?: string;
}
