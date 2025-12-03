import { apiClient } from './axios-config';
import { TransactionStatistics, StatisticsFilters } from './models/statistics.model';

/**
 * Get transaction statistics
 */
export const getStatistics = async (filters?: StatisticsFilters): Promise<TransactionStatistics> => {
    const params = new URLSearchParams();

    if (filters?.branchId) {
        params.append('branchId', filters.branchId.toString());
    }
    if (filters?.startDate) {
        params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
        params.append('endDate', filters.endDate);
    }

    const response = await apiClient.get<TransactionStatistics>(
        `/statistics?${params.toString()}`
    );
    return response.data;
};

/**
 * Export transactions to CSV
 */
export const exportToCSV = async (filters?: StatisticsFilters): Promise<Blob> => {
    const params = new URLSearchParams();

    if (filters?.branchId) {
        params.append('branchId', filters.branchId.toString());
    }
    if (filters?.startDate) {
        params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
        params.append('endDate', filters.endDate);
    }

    const response = await apiClient.get(
        `/export/csv?${params.toString()}`,
        { responseType: 'blob' }
    );
    return response.data;
};

/**
 * Export transactions to JSON
 */
export const exportToJSON = async (filters?: StatisticsFilters): Promise<Blob> => {
    const params = new URLSearchParams();

    if (filters?.branchId) {
        params.append('branchId', filters.branchId.toString());
    }
    if (filters?.startDate) {
        params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
        params.append('endDate', filters.endDate);
    }

    const response = await apiClient.get(
        `/export/json?${params.toString()}`,
        { responseType: 'blob' }
    );
    return response.data;
};

/**
 * Export transactions to PDF
 */
export const exportToPDF = async (filters?: StatisticsFilters): Promise<Blob> => {
    const params = new URLSearchParams();

    if (filters?.branchId) {
        params.append('branchId', filters.branchId.toString());
    }
    if (filters?.startDate) {
        params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
        params.append('endDate', filters.endDate);
    }

    const response = await apiClient.get(
        `/export/pdf?${params.toString()}`,
        { responseType: 'blob' }
    );
    return response.data;
};

/**
 * Helper function to download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
