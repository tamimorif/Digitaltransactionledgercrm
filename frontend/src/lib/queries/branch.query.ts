import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../axios-config';
import type {
    Branch,
    CreateBranchRequest,
    UpdateBranchRequest,
    AssignUserRequest,
} from '../models/branch.model';

// ==================== Branch Queries ====================

export function useGetBranches() {
    return useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: async () => {
            const response = await axiosInstance.get('/branches');
            return response.data;
        },
    });
}

export function useGetBranch(branchId: number) {
    return useQuery<Branch>({
        queryKey: ['branch', branchId],
        queryFn: async () => {
            const response = await axiosInstance.get(`/branches/${branchId}`);
            return response.data;
        },
        enabled: !!branchId,
    });
}

export function useGetUserBranches() {
    return useQuery<Branch[]>({
        queryKey: ['userBranches'],
        queryFn: async () => {
            const response = await axiosInstance.get('/branches/my-branches');
            return response.data;
        },
    });
}

// ==================== Branch Mutations ====================

export function useCreateBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateBranchRequest) => {
            const response = await axiosInstance.post('/branches', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });
}

export function useUpdateBranch(branchId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateBranchRequest) => {
            const response = await axiosInstance.put(`/branches/${branchId}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            queryClient.invalidateQueries({ queryKey: ['branch', branchId] });
        },
    });
}

export function useDeactivateBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (branchId: number) => {
            const response = await axiosInstance.post(`/branches/${branchId}/deactivate`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });
}

export function useAssignUserToBranch(branchId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: AssignUserRequest) => {
            const response = await axiosInstance.post(`/branches/${branchId}/assign-user`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            queryClient.invalidateQueries({ queryKey: ['branch', branchId] });
        },
    });
}
