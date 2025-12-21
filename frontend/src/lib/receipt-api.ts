import { apiClient } from './api-client';

// Types
export interface ReceiptTemplate {
    id: number;
    tenantId: number;
    name: string;
    description?: string;
    templateType: 'transaction' | 'remittance' | 'pickup' | 'general';
    headerHtml: string;
    bodyHtml: string;
    footerHtml: string;
    styleCss?: string;
    pageSize: 'A4' | 'Letter' | 'Receipt';
    orientation: 'portrait' | 'landscape';
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    logoPath?: string;
    logoPosition: 'left' | 'center' | 'right';
    isDefault: boolean;
    isActive: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface ReceiptVariable {
    name: string;
    description: string;
    example: string;
    category: string;
}

export interface CreateTemplateRequest {
    name: string;
    description?: string;
    templateType?: string;
    headerHtml?: string;
    bodyHtml?: string;
    footerHtml?: string;
    styleCss?: string;
    pageSize?: string;
    orientation?: string;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    logoPath?: string;
    logoPosition?: string;
    isDefault?: boolean;
}

// API Functions
export async function listTemplates(includeInactive = false): Promise<ReceiptTemplate[]> {
    const url = `/receipts/templates${includeInactive ? '?includeInactive=true' : ''}`;
    const response = await apiClient.get<ReceiptTemplate[]>(url);
    return response.data;
}

export async function getTemplate(id: number): Promise<ReceiptTemplate> {
    const response = await apiClient.get<ReceiptTemplate>(`/receipts/templates/${id}`);
    return response.data;
}

export async function createTemplate(request: CreateTemplateRequest): Promise<ReceiptTemplate> {
    const response = await apiClient.post<ReceiptTemplate>('/receipts/templates', request);
    return response.data;
}

export async function updateTemplate(id: number, request: CreateTemplateRequest): Promise<ReceiptTemplate> {
    const response = await apiClient.put<ReceiptTemplate>(`/receipts/templates/${id}`, request);
    return response.data;
}

export async function deleteTemplate(id: number): Promise<void> {
    await apiClient.delete(`/receipts/templates/${id}`);
}

export async function setDefaultTemplate(id: number): Promise<void> {
    await apiClient.put(`/receipts/templates/${id}/default`);
}

export async function duplicateTemplate(id: number, name?: string): Promise<ReceiptTemplate> {
    const response = await apiClient.post<ReceiptTemplate>(`/receipts/templates/${id}/duplicate`, { name });
    return response.data;
}

export async function previewTemplate(id: number): Promise<string> {
    // For HTML response, we need to handle it differently or use text responseType
    const response = await apiClient.get<string>(`/receipts/templates/${id}/preview`, {
        responseType: 'text'
    });
    return response.data;
}

export async function getAvailableVariables(templateType = 'transaction'): Promise<ReceiptVariable[]> {
    const response = await apiClient.get<ReceiptVariable[]>(`/receipts/variables?type=${templateType}`);
    return response.data;
}

export async function renderReceipt(templateId: number | null, templateType: string, data: Record<string, unknown>): Promise<string> {
    const response = await apiClient.post<string>('/receipts/render', {
        templateId,
        templateType,
        data,
    }, { responseType: 'text' });
    return response.data;
}

export async function createDefaultTemplates(): Promise<void> {
    await apiClient.post('/receipts/templates/defaults');
}


// Template type labels
export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
    transaction: 'Transaction Receipt',
    remittance: 'Remittance Receipt',
    pickup: 'Pickup Confirmation',
    general: 'General Receipt',
};

// Page size options
export const PAGE_SIZE_OPTIONS = [
    { value: 'A4', label: 'A4 (210 × 297 mm)' },
    { value: 'Letter', label: 'Letter (8.5 × 11 in)' },
    { value: 'Receipt', label: 'Receipt (80mm)' },
];

// Orientation options
export const ORIENTATION_OPTIONS = [
    { value: 'portrait', label: 'Portrait' },
    { value: 'landscape', label: 'Landscape' },
];
