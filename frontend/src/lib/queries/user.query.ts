import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getUsers,
    createBranchUser,
    updateUser,
    deleteUser,
    checkUsernameAvailability,
    CreateBranchUserRequest,
    UpdateUserRequest,
} from '../user-api';

// Query keys
export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    detail: (id: number) => [...userKeys.all, 'detail', id] as const,
};

// Get all users
export const useGetUsers = () => {
    return useQuery({
        queryKey: userKeys.lists(),
        queryFn: getUsers,
    });
};

// Check username availability (with debounce)
export const useCheckUsername = (username: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['checkUsername', username],
        queryFn: () => checkUsernameAvailability(username),
        enabled: enabled && username.length >= 3,
        staleTime: 30000, // Cache for 30 seconds
    });
};

// Create branch user
export const useCreateBranchUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateBranchUserRequest) => createBranchUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
};

// Update user
export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
};

// Delete user
export const useDeleteUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
};
