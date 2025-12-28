import axiosInstance from './axios-config';
import {
    PickupTransaction,
    CreatePickupTransactionRequest,
    PickupTransactionsResponse,
    PickupStatus,
} from './models/pickup.model';

// Create pickup transaction
export const createPickupTransaction = async (
    data: CreatePickupTransactionRequest
): Promise<PickupTransaction> => {
    const response = await axiosInstance.post('/pickups', data);
    return response.data;
};

// Get pickup transactions with filters
export const getPickupTransactions = async (
    branchId?: number,
    status?: PickupStatus,
    page = 1,
    limit = 20
): Promise<PickupTransactionsResponse> => {
    const params: Record<string, string | number> = { page, limit };
    if (branchId) params.branch_id = branchId;
    if (status) params.status = status;

    const response = await axiosInstance.get('/pickups', { params });
    return response.data;
};

// Get single pickup transaction
export const getPickupTransaction = async (id: number): Promise<PickupTransaction> => {
    const response = await axiosInstance.get(`/pickups/${id}`);
    return response.data;
};

// Search pickup by code
export const searchPickupByCode = async (code: string): Promise<PickupTransaction> => {
    const response = await axiosInstance.get(`/pickups/search/${code}`);
    return response.data;
};

// Mark pickup as picked up
export const markAsPickedUp = async (id: number): Promise<{ message: string }> => {
    const response = await axiosInstance.post(`/pickups/${id}/pickup`);
    return response.data;
};

// Cancel pickup transaction
export const cancelPickupTransaction = async (
    id: number,
    reason: string
): Promise<{ message: string }> => {
    const response = await axiosInstance.post(`/pickups/${id}/cancel`, { reason });
    return response.data;
};

// Get pending pickups count for a branch
export const getPendingPickupsCount = async (branchId: number): Promise<{ count: number }> => {
    const response = await axiosInstance.get('/pickups/pending/count', {
        params: { branch_id: branchId },
    });
    return response.data;
};
