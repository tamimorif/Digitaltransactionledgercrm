import axiosInstance from './axios-config';

// Types
export interface GlobalSearchResult {
    type: string;
    id: number;
    title: string;
    subtitle: string;
    description: string;
    data: Record<string, unknown>;
    createdAt?: string;
}

export interface SearchFilter {
    entity: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
    status?: string[];
    currency?: string[];
    branchId?: number;
    customFields?: Record<string, unknown>;
}

export interface SavedSearch {
    id: number;
    userId: number;
    tenantId: number;
    name: string;
    description: string;
    entity: string;
    filters: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdvancedSearchResponse {
    results: unknown[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

// Global Search
export async function globalSearch(query: string, limit: number = 50): Promise<GlobalSearchResult[]> {
    try {
        const response = await axiosInstance.get('/search/global', {
            params: { q: query, limit }
        });
        return response.data.results || [];
    } catch (error) {
        console.error('Global search failed:', error);
        throw error;
    }
}

// Advanced Search
export async function advancedSearch(
    filter: SearchFilter,
    page: number = 1,
    limit: number = 20
): Promise<AdvancedSearchResponse> {
    try {
        const response = await axiosInstance.post('/search/advanced', filter, {
            params: { page, limit }
        });
        return response.data;
    } catch (error) {
        console.error('Advanced search failed:', error);
        throw error;
    }
}

// Save Search
export async function saveSearch(
    name: string,
    description: string,
    filter: SearchFilter
): Promise<SavedSearch> {
    try {
        const response = await axiosInstance.post('/search/save', {
            name,
            description,
            filter
        });
        return response.data;
    } catch (error) {
        console.error('Save search failed:', error);
        throw error;
    }
}

// Get Saved Searches
export async function getSavedSearches(): Promise<SavedSearch[]> {
    try {
        const response = await axiosInstance.get('/search/saved');
        return response.data || [];
    } catch (error) {
        console.error('Get saved searches failed:', error);
        throw error;
    }
}

// Delete Saved Search
export async function deleteSavedSearch(id: number): Promise<void> {
    try {
        await axiosInstance.delete(`/search/saved/${id}`, {
            params: { id }
        });
    } catch (error) {
        console.error('Delete saved search failed:', error);
        throw error;
    }
}
