import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    checkTransactionCompliance,
    getComplianceAuditLog,
    getComplianceDocuments,
    getCustomerCompliance,
    getExpiringCompliance,
    getPendingReviews,
    getVerificationStatus,
    initiateVerification,
    reviewDocument,
    setTransactionLimits,
    updateComplianceStatus,
    uploadComplianceDocument,
    type ComplianceStatus,
    type DocumentType,
} from '../compliance-api';

// Query Keys
export const complianceKeys = {
    all: ['compliance'] as const,
    customer: (customerId: number) => [...complianceKeys.all, 'customer', customerId] as const,
    documents: (complianceId: number) => [...complianceKeys.all, 'documents', complianceId] as const,
    auditLog: (complianceId: number) => [...complianceKeys.all, 'audit', complianceId] as const,
    pending: () => [...complianceKeys.all, 'pending'] as const,
    expiring: (days?: number) => [...complianceKeys.all, 'expiring', days] as const,
    verification: (complianceId: number) => [...complianceKeys.all, 'verification', complianceId] as const,
};

// Queries
export function useCustomerCompliance(customerId: number) {
    return useQuery({
        queryKey: complianceKeys.customer(customerId),
        queryFn: () => getCustomerCompliance(customerId),
        enabled: !!customerId,
    });
}

export function useComplianceDocuments(complianceId: number) {
    return useQuery({
        queryKey: complianceKeys.documents(complianceId),
        queryFn: () => getComplianceDocuments(complianceId),
        enabled: !!complianceId,
    });
}

export function useComplianceAuditLog(complianceId: number, limit?: number) {
    return useQuery({
        queryKey: complianceKeys.auditLog(complianceId),
        queryFn: () => getComplianceAuditLog(complianceId, limit),
        enabled: !!complianceId,
    });
}

export function usePendingReviews(limit?: number) {
    return useQuery({
        queryKey: complianceKeys.pending(),
        queryFn: () => getPendingReviews(limit),
    });
}

export function useExpiringCompliance(days?: number) {
    return useQuery({
        queryKey: complianceKeys.expiring(days),
        queryFn: () => getExpiringCompliance(days),
    });
}

export function useVerificationStatus(complianceId: number, enabled: boolean = true) {
    return useQuery({
        queryKey: complianceKeys.verification(complianceId),
        queryFn: () => getVerificationStatus(complianceId),
        enabled: enabled && !!complianceId,
        refetchInterval: 5000, // Poll every 5 seconds when enabled
    });
}

// Mutations
export function useCheckTransactionCompliance() {
    return useMutation({
        mutationFn: ({
            customerId,
            amount,
            currency,
        }: {
            customerId: number;
            amount: number;
            currency: string;
        }) => checkTransactionCompliance(customerId, amount, currency),
    });
}

export function useUpdateComplianceStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            complianceId,
            status,
            reason,
        }: {
            complianceId: number;
            status: ComplianceStatus;
            reason?: string;
        }) => updateComplianceStatus(complianceId, status, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: complianceKeys.all });
        },
    });
}

export function useSetTransactionLimits() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            complianceId,
            dailyLimit,
            monthlyLimit,
            perTransactionLimit,
        }: {
            complianceId: number;
            dailyLimit: number;
            monthlyLimit: number;
            perTransactionLimit: number;
        }) => setTransactionLimits(complianceId, dailyLimit, monthlyLimit, perTransactionLimit),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: complianceKeys.all });
        },
    });
}

export function useUploadComplianceDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            complianceId,
            documentType,
            file,
        }: {
            complianceId: number;
            documentType: DocumentType;
            file: File;
        }) => uploadComplianceDocument(complianceId, documentType, file),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: complianceKeys.documents(variables.complianceId) });
        },
    });
}

export function useReviewDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            docId,
            approved,
            notes,
        }: {
            docId: number;
            complianceId: number;
            approved: boolean;
            notes?: string;
        }) => reviewDocument(docId, approved, notes),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: complianceKeys.documents(variables.complianceId) });
            queryClient.invalidateQueries({ queryKey: complianceKeys.pending() });
        },
    });
}

export function useInitiateVerification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (complianceId: number) => initiateVerification(complianceId),
        onSuccess: (_, complianceId) => {
            queryClient.invalidateQueries({ queryKey: complianceKeys.verification(complianceId) });
        },
    });
}
