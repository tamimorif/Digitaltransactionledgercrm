import { apiClient } from './api-client';

// Types
export interface CustomerCompliance {
    id: number;
    tenantId: number;
    customerId: number;
    status: ComplianceStatus;
    kycLevel: string;
    riskLevel: RiskLevel;
    idVerified: boolean;
    addressVerified: boolean;
    idDocumentType?: string;
    idDocumentNumber?: string;
    idExpiryDate?: string;
    country?: string;
    dailyLimit: number;
    monthlyLimit: number;
    perTransactionLimit: number;
    usedDailyAmount: number;
    usedMonthlyAmount: number;
    lastVerificationDate?: string;
    nextReviewDate?: string;
    notes?: string;
    externalProviderId?: string;
    amlScreeningDate?: string;
    amlStatus?: string;
    pepStatus?: string;
    sanctionsStatus?: string;
    createdAt: string;
    updatedAt: string;
    customer?: Customer;
}

export interface Customer {
    id: number;
    fullName: string;
    phone: string;
    email?: string;
}

export interface ComplianceDocument {
    id: number;
    customerComplianceId: number;
    tenantId: number;
    documentType: string;
    originalFilename: string;
    storagePath: string;
    fileSize: number;
    mimeType: string;
    status: DocumentStatus;
    rejectionReason?: string;
    verifiedAt?: string;
    verifiedBy?: number;
    createdAt: string;
    uploadedBy?: number;
}

export interface ComplianceAuditLog {
    id: number;
    customerComplianceId: number;
    action: string;
    details: string;
    previousValue?: string;
    newValue?: string;
    performedBy?: number;
    ipAddress?: string;
    createdAt: string;
}

export interface ComplianceCheckResult {
    allowed: boolean;
    reason: string;
    dailyRemaining: number;
    monthlyRemaining: number;
    perTransactionLimit: number;
    riskLevel: string;
}

export interface VerificationToken {
    applicantId: string;
    token: string;
    expiresAt: string;
}

export interface VerificationStatus {
    applicantId: string;
    reviewStatus: string;
    reviewResult?: string;
    reviewAnswer?: string;
    rejectLabels?: string[];
    moderatedAt?: string;
    idDocStatus?: string;
    selfieStatus?: string;
    addressStatus?: string;
    riskScore?: number;
}

export type ComplianceStatus =
    | 'PENDING'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'SUSPENDED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DocumentType =
    | 'ID_FRONT'
    | 'ID_BACK'
    | 'PASSPORT'
    | 'DRIVING_LICENSE'
    | 'SELFIE'
    | 'ADDRESS_PROOF'
    | 'UTILITY_BILL'
    | 'BANK_STATEMENT';

// API Functions
export async function getCustomerCompliance(customerId: number): Promise<CustomerCompliance> {
    const response = await apiClient.get<CustomerCompliance>(`/compliance/customer/${customerId}`);
    return response.data;
}

export async function checkTransactionCompliance(
    customerId: number,
    amount: number,
    currency: string
): Promise<ComplianceCheckResult> {
    const response = await apiClient.post<ComplianceCheckResult>('/compliance/check', {
        customerId,
        amount,
        currency,
    });
    return response.data;
}

export async function updateComplianceStatus(
    complianceId: number,
    status: ComplianceStatus,
    reason?: string
): Promise<void> {
    await apiClient.put(`/compliance/${complianceId}/status`, { status, reason });
}

export async function setTransactionLimits(
    complianceId: number,
    dailyLimit: number,
    monthlyLimit: number,
    perTransactionLimit: number
): Promise<void> {
    await apiClient.put(`/compliance/${complianceId}/limits`, {
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
    });
}

export async function getComplianceDocuments(complianceId: number): Promise<ComplianceDocument[]> {
    const response = await apiClient.get<ComplianceDocument[]>(`/compliance/${complianceId}/documents`);
    return response.data;
}

export async function uploadComplianceDocument(
    complianceId: number,
    documentType: DocumentType,
    file: File
): Promise<ComplianceDocument> {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);

    const response = await apiClient.post<ComplianceDocument>(
        `/compliance/${complianceId}/documents`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return response.data;
}

export async function reviewDocument(
    docId: number,
    approved: boolean,
    notes?: string
): Promise<void> {
    await apiClient.put(`/compliance/documents/${docId}/review`, { approved, notes });
}

export async function getPendingReviews(limit?: number): Promise<CustomerCompliance[]> {
    const response = await apiClient.get<CustomerCompliance[]>('/compliance/pending', {
        params: { limit },
    });
    return response.data;
}

export async function getExpiringCompliance(days?: number): Promise<CustomerCompliance[]> {
    const response = await apiClient.get<CustomerCompliance[]>('/compliance/expiring', {
        params: { days },
    });
    return response.data;
}

export async function getComplianceAuditLog(
    complianceId: number,
    limit?: number
): Promise<ComplianceAuditLog[]> {
    const response = await apiClient.get<ComplianceAuditLog[]>(`/compliance/${complianceId}/audit`, {
        params: { limit },
    });
    return response.data;
}

export async function initiateVerification(complianceId: number): Promise<VerificationToken> {
    const response = await apiClient.post<VerificationToken>(`/compliance/${complianceId}/verify`);
    return response.data;
}

export async function getVerificationStatus(complianceId: number): Promise<VerificationStatus> {
    const response = await apiClient.get<VerificationStatus>(`/compliance/${complianceId}/verify/status`);
    return response.data;
}
