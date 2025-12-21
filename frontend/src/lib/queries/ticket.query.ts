import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ticketApi from '../ticket-api';
import type { TicketFilter, CreateTicketRequest, TicketStatus, TicketPriority } from '../ticket-api';

// Query keys
export const ticketKeys = {
    all: ['tickets'] as const,
    lists: () => [...ticketKeys.all, 'list'] as const,
    list: (filter: TicketFilter) => [...ticketKeys.lists(), filter] as const,
    details: () => [...ticketKeys.all, 'detail'] as const,
    detail: (id: number) => [...ticketKeys.details(), id] as const,
    messages: (id: number) => [...ticketKeys.all, 'messages', id] as const,
    activity: (id: number) => [...ticketKeys.all, 'activity', id] as const,
    stats: () => [...ticketKeys.all, 'stats'] as const,
    my: () => [...ticketKeys.all, 'my'] as const,
};

// Queries
export function useTickets(filter: TicketFilter = {}) {
    return useQuery({
        queryKey: ticketKeys.list(filter),
        queryFn: () => ticketApi.listTickets(filter),
    });
}

export function useTicket(id: number) {
    return useQuery({
        queryKey: ticketKeys.detail(id),
        queryFn: () => ticketApi.getTicket(id),
        enabled: id > 0,
    });
}

export function useTicketMessages(id: number, includeInternal = false) {
    return useQuery({
        queryKey: ticketKeys.messages(id),
        queryFn: () => ticketApi.getTicketMessages(id, includeInternal),
        enabled: id > 0,
        refetchInterval: 30000, // Refetch every 30 seconds for new messages
    });
}

export function useTicketActivity(id: number) {
    return useQuery({
        queryKey: ticketKeys.activity(id),
        queryFn: () => ticketApi.getTicketActivity(id),
        enabled: id > 0,
    });
}

export function useTicketStats() {
    return useQuery({
        queryKey: ticketKeys.stats(),
        queryFn: () => ticketApi.getTicketStats(),
        refetchInterval: 60000, // Refresh stats every minute
    });
}

export function useMyTickets(includeClosed = false) {
    return useQuery({
        queryKey: ticketKeys.my(),
        queryFn: () => ticketApi.getMyTickets(includeClosed),
    });
}

export function useSearchTickets(query: string) {
    return useQuery({
        queryKey: ['tickets', 'search', query],
        queryFn: () => ticketApi.searchTickets(query),
        enabled: query.length > 2,
    });
}

// Mutations
export function useCreateTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: CreateTicketRequest) => ticketApi.createTicket(request),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.stats() });
        },
    });
}

export function useUpdateTicketStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status }: { id: number; status: TicketStatus }) =>
            ticketApi.updateTicketStatus(id, status),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.stats() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.my() });
        },
    });
}

export function useUpdateTicketPriority() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, priority }: { id: number; priority: TicketPriority }) =>
            ticketApi.updateTicketPriority(id, priority),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
        },
    });
}

export function useAssignTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, assignToUserId }: { id: number; assignToUserId: number }) =>
            ticketApi.assignTicket(id, assignToUserId),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.stats() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.my() });
        },
    });
}

export function useResolveTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, resolution }: { id: number; resolution: string }) =>
            ticketApi.resolveTicket(id, resolution),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.stats() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.my() });
        },
    });
}

export function useAddTicketMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, content, isInternal }: { id: number; content: string; isInternal?: boolean }) =>
            ticketApi.addTicketMessage(id, content, isInternal),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.messages(id) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.activity(id) });
        },
    });
}

export function useCreateQuickTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ entityType, entityId, issue }: { entityType: string; entityId: number; issue: string }) =>
            ticketApi.createQuickTicket(entityType, entityId, issue),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.stats() });
        },
    });
}
