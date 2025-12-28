import axiosInstance from './axios-config';
import {
    CashBalance,
    CashAdjustment,
    CreateAdjustmentRequest,
    AdjustmentHistoryResponse,
} from './models/cash-balance.model';

// Get all balances for tenant
export const getAllBalances = async (branchId?: number): Promise<CashBalance[]> => {
    const params = branchId ? { branch_id: branchId } : {};
    const response = await axiosInstance.get('/cash-balances', { params });
    return response.data;
};

// Get balance for specific currency
export const getBalanceByCurrency = async (
    currency: string,
    branchId?: number
): Promise<CashBalance> => {
    const params = branchId ? { branch_id: branchId } : {};
    const response = await axiosInstance.get(`/cash-balances/${currency}`, { params });
    return response.data;
};

// Refresh balance (recalculate from transactions)
export const refreshBalance = async (id: number): Promise<CashBalance> => {
    const response = await axiosInstance.post(`/cash-balances/${id}/refresh`);
    return response.data;
};

// Refresh all balances
export const refreshAllBalances = async (): Promise<{ message: string }> => {
    const response = await axiosInstance.post('/cash-balances/refresh-all');
    return response.data;
};

// Create manual adjustment
export const createAdjustment = async (
    data: CreateAdjustmentRequest
): Promise<CashAdjustment> => {
    const response = await axiosInstance.post('/cash-balances/adjust', data);
    return response.data;
};

// Get adjustment history
export const getAdjustmentHistory = async (
    branchId?: number,
    currency?: string,
    page = 1,
    limit = 20
): Promise<AdjustmentHistoryResponse> => {
    const params: Record<string, string | number> = { page, limit };
    if (branchId) params.branch_id = branchId;
    if (currency) params.currency = currency;

    const response = await axiosInstance.get('/cash-balances/adjustments', { params });
    return response.data;
};

// Get active currencies
export const getActiveCurrencies = async (branchId?: number): Promise<string[]> => {
    const params = branchId ? { branch_id: branchId } : {};
    const response = await axiosInstance.get('/cash-balances/currencies', { params });
    return response.data.currencies;
};
