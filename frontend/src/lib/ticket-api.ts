import { apiClient } from './api-client';

// Types
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketCategory = 'GENERAL' | 'TRANSACTION' | 'REMITTANCE' | 'COMPLIANCE' | 'TECHNICAL' | 'BILLING' | 'ACCOUNT_ACCESS';

export interface Ticket {
    id: number;
    tenantId: number;
    ticketCode: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    description: string;
    createdByUserId?: number;
    customerId?: number;
    assignedToUserId?: number;
    branchId?: number;
    relatedEntityType?: string;
    relatedEntityId?: number;
    tags?: string;
    resolution?: string;
    resolvedAt?: string;
    dueAt?: string;
    breachedSla?: boolean;
    createdAt: string;
    updatedAt: string;
    createdByUser?: { id: number; email: string };
    assignedToUser?: { id: number; email: string };
    customer?: { id: number; fullName: string };
}

export interface TicketMessage {
    id: number;
    ticketId: number;
    authorUserId?: number;
    authorName: string;
    content: string;
    contentType: string;
    isInternal: boolean;
    isSystemMessage: boolean;
    systemAction?: string;
    createdAt: string;
    authorUser?: { id: number; email: string };
}

export interface TicketActivity {
    id: number;
    ticketId: number;
    action: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    description: string;
    performedByUserId?: number;
    isSystemAction: boolean;
    createdAt: string;
    performedByUser?: { id: number; email: string };
}

export interface TicketStats {
    openCount: number;
    inProgressCount: number;
    waitingCount: number;
    resolvedCount: number;
    closedCount: number;
    criticalCount: number;
    highPriorityCount: number;
    slaBreachCount: number;
    unassignedCount: number;
}

export interface TicketListResponse {
    tickets: Ticket[];
    total: number;
    page: number;
    limit: number;
}

export interface CreateTicketRequest {
    subject: string;
    description: string;
    priority?: TicketPriority;
    category?: TicketCategory;
    customerId?: number;
    assignedToUserId?: number;
    branchId?: number;
    relatedEntityType?: string;
    relatedEntityId?: number;
    tags?: string;
}

export interface TicketFilter {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedTo?: number;
    branchId?: number;
    search?: string;
    includeClosed?: boolean;
    page?: number;
    limit?: number;
}

// API Functions
export async function listTickets(filter: TicketFilter = {}): Promise<TicketListResponse> {
    const params = new URLSearchParams();
    if (filter.status) params.append('status', filter.status);
    if (filter.priority) params.append('priority', filter.priority);
    if (filter.category) params.append('category', filter.category);
    if (filter.assignedTo) params.append('assignedTo', filter.assignedTo.toString());
    if (filter.branchId) params.append('branchId', filter.branchId.toString());
    if (filter.search) params.append('search', filter.search);
    if (filter.includeClosed) params.append('includeClosed', 'true');
    if (filter.page) params.append('page', filter.page.toString());
    if (filter.limit) params.append('limit', filter.limit.toString());

    const url = `/tickets${params.toString() ? '?' + params.toString() : ''}`;
    const response = await apiClient.get<TicketListResponse>(url);
    return response.data;
}

export async function getTicket(id: number): Promise<Ticket> {
    const response = await apiClient.get<Ticket>(`/tickets/${id}`);
    return response.data;
}

export async function createTicket(request: CreateTicketRequest): Promise<Ticket> {
    const response = await apiClient.post<Ticket>('/tickets', request);
    return response.data;
}

export async function updateTicketStatus(id: number, status: TicketStatus): Promise<void> {
    await apiClient.put(`/tickets/${id}/status`, { status });
}

export async function updateTicketPriority(id: number, priority: TicketPriority): Promise<void> {
    await apiClient.put(`/tickets/${id}/priority`, { priority });
}

export async function assignTicket(id: number, assignToUserId: number): Promise<void> {
    await apiClient.put(`/tickets/${id}/assign`, { assignToUserId });
}

export async function resolveTicket(id: number, resolution: string): Promise<void> {
    await apiClient.post(`/tickets/${id}/resolve`, { resolution });
}

export async function getTicketMessages(id: number, includeInternal = false): Promise<TicketMessage[]> {
    const url = `/tickets/${id}/messages${includeInternal ? '?includeInternal=true' : ''}`;
    const response = await apiClient.get<TicketMessage[]>(url);
    return response.data;
}

export async function addTicketMessage(id: number, content: string, isInternal = false): Promise<TicketMessage> {
    const response = await apiClient.post<TicketMessage>(`/tickets/${id}/messages`, { content, isInternal });
    return response.data;
}

export async function getTicketActivity(id: number, limit = 50): Promise<TicketActivity[]> {
    const response = await apiClient.get<TicketActivity[]>(`/tickets/${id}/activity?limit=${limit}`);
    return response.data;
}

export async function getTicketStats(): Promise<TicketStats> {
    const response = await apiClient.get<TicketStats>('/tickets/stats');
    return response.data;
}

export async function getMyTickets(includeClosed = false): Promise<Ticket[]> {
    const response = await apiClient.get<Ticket[]>(`/tickets/my${includeClosed ? '?includeClosed=true' : ''}`);
    return response.data;
}

export async function searchTickets(query: string, limit = 20): Promise<Ticket[]> {
    const response = await apiClient.get<Ticket[]>(`/tickets/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data;
}

export async function createQuickTicket(entityType: string, entityId: number, issue: string): Promise<Ticket> {
    const response = await apiClient.post<Ticket>('/tickets/quick', { entityType, entityId, issue });
    return response.data;
}


// Priority/Status utilities
export const PRIORITY_COLORS: Record<TicketPriority, string> = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
    OPEN: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    WAITING_CUSTOMER: 'bg-purple-100 text-purple-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-700',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    WAITING_CUSTOMER: 'Waiting',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
    GENERAL: 'General',
    TRANSACTION: 'Transaction',
    REMITTANCE: 'Remittance',
    COMPLIANCE: 'Compliance',
    TECHNICAL: 'Technical',
    BILLING: 'Billing',
    ACCOUNT_ACCESS: 'Account Access',
};
