import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as receiptApi from '../receipt-api';
import type { CreateTemplateRequest } from '../receipt-api';

// Query keys
export const receiptKeys = {
    all: ['receipts'] as const,
    templates: () => [...receiptKeys.all, 'templates'] as const,
    template: (id: number) => [...receiptKeys.templates(), id] as const,
    preview: (id: number) => [...receiptKeys.all, 'preview', id] as const,
    variables: (type: string) => [...receiptKeys.all, 'variables', type] as const,
};

// Queries
export function useTemplates(includeInactive = false) {
    return useQuery({
        queryKey: receiptKeys.templates(),
        queryFn: () => receiptApi.listTemplates(includeInactive),
    });
}

export function useTemplate(id: number) {
    return useQuery({
        queryKey: receiptKeys.template(id),
        queryFn: () => receiptApi.getTemplate(id),
        enabled: id > 0,
    });
}

export function useTemplatePreview(id: number) {
    return useQuery({
        queryKey: receiptKeys.preview(id),
        queryFn: () => receiptApi.previewTemplate(id),
        enabled: id > 0,
    });
}

export function useAvailableVariables(templateType = 'transaction') {
    return useQuery({
        queryKey: receiptKeys.variables(templateType),
        queryFn: () => receiptApi.getAvailableVariables(templateType),
    });
}

// Mutations
export function useCreateTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: CreateTemplateRequest) => receiptApi.createTemplate(request),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: receiptKeys.templates() });
        },
    });
}

export function useUpdateTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, request }: { id: number; request: CreateTemplateRequest }) =>
            receiptApi.updateTemplate(id, request),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: receiptKeys.template(id) });
            queryClient.invalidateQueries({ queryKey: receiptKeys.templates() });
            queryClient.invalidateQueries({ queryKey: receiptKeys.preview(id) });
        },
    });
}

export function useDeleteTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => receiptApi.deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: receiptKeys.templates() });
        },
    });
}

export function useSetDefaultTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => receiptApi.setDefaultTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: receiptKeys.templates() });
        },
    });
}

export function useDuplicateTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, name }: { id: number; name?: string }) => receiptApi.duplicateTemplate(id, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: receiptKeys.templates() });
        },
    });
}

export function useCreateDefaultTemplates() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => receiptApi.createDefaultTemplates(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: receiptKeys.templates() });
        },
    });
}
