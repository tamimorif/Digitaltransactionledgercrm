import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAllFeeRules,
    getFeeRuleById,
    createFeeRule,
    updateFeeRule,
    deleteFeeRule,
    createDefaultFeeRules,
    calculateFee,
    previewFee,
    CreateFeeRuleRequest,
} from '../fee-api';

// Query keys
export const feeKeys = {
    all: ['fee-rules'] as const,
    lists: () => [...feeKeys.all, 'list'] as const,
    list: (filters: { includeInactive?: boolean }) => [...feeKeys.lists(), filters] as const,
    details: () => [...feeKeys.all, 'detail'] as const,
    detail: (id: number) => [...feeKeys.details(), id] as const,
};

// Get all fee rules
export const useGetFeeRules = (includeInactive?: boolean) => {
    return useQuery({
        queryKey: feeKeys.list({ includeInactive }),
        queryFn: () => getAllFeeRules(includeInactive),
    });
};

// Get a specific fee rule
export const useGetFeeRule = (id: number) => {
    return useQuery({
        queryKey: feeKeys.detail(id),
        queryFn: () => getFeeRuleById(id),
        enabled: !!id,
    });
};

// Create fee rule mutation
export const useCreateFeeRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateFeeRuleRequest) => createFeeRule(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: feeKeys.all });
        },
    });
};

// Update fee rule mutation
export const useUpdateFeeRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CreateFeeRuleRequest> }) =>
            updateFeeRule(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: feeKeys.all });
        },
    });
};

// Delete fee rule mutation
export const useDeleteFeeRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteFeeRule(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: feeKeys.all });
        },
    });
};

// Create default rules mutation
export const useCreateDefaultFeeRules = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => createDefaultFeeRules(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: feeKeys.all });
        },
    });
};

// Calculate fee mutation (for transaction forms)
export const useCalculateFee = () => {
    return useMutation({
        mutationFn: ({
            amount,
            sourceCurrency,
            destinationCountry,
        }: {
            amount: number;
            sourceCurrency: string;
            destinationCountry: string;
        }) => calculateFee(amount, sourceCurrency, destinationCountry),
    });
};

// Preview fee query (for real-time preview)
export const usePreviewFee = (
    amount: number,
    sourceCurrency?: string,
    destinationCountry?: string
) => {
    return useQuery({
        queryKey: ['fee-preview', amount, sourceCurrency, destinationCountry],
        queryFn: () => previewFee(amount, sourceCurrency, destinationCountry),
        enabled: amount > 0,
        staleTime: 30000, // Cache for 30 seconds
    });
};
