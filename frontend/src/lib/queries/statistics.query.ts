import { useQuery, useMutation } from '@tanstack/react-query';
import { getStatistics, exportToCSV, exportToJSON, exportToPDF, downloadBlob } from '../statistics-api';
import { StatisticsFilters } from '../models/statistics.model';

/**
 * Hook to get transaction statistics
 */
export const useGetStatistics = (filters?: StatisticsFilters) => {
    return useQuery({
        queryKey: ['statistics', filters],
        queryFn: () => getStatistics(filters),
    });
};

/**
 * Hook to export transactions to CSV
 */
export const useExportToCSV = () => {
    return useMutation({
        mutationFn: (filters?: StatisticsFilters) => exportToCSV(filters),
        onSuccess: (blob) => {
            const filename = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
            downloadBlob(blob, filename);
        },
    });
};

/**
 * Hook to export transactions to JSON
 */
export const useExportToJSON = () => {
    return useMutation({
        mutationFn: (filters?: StatisticsFilters) => exportToJSON(filters),
        onSuccess: (blob) => {
            const filename = `transactions_export_${new Date().toISOString().split('T')[0]}.json`;
            downloadBlob(blob, filename);
        },
    });
};

/**
 * Hook to export transactions to PDF
 */
export const useExportToPDF = () => {
    return useMutation({
        mutationFn: (filters?: StatisticsFilters) => exportToPDF(filters),
        onSuccess: (blob) => {
            const filename = `transactions_report_${new Date().toISOString().split('T')[0]}.pdf`;
            downloadBlob(blob, filename);
        },
    });
};
