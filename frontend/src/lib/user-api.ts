import axiosInstance from './axios-config';

export interface User {
    id: number;
    username?: string;
    email: string;
    role: string;
    tenantId?: number;
    primaryBranchId?: number;
    primaryBranch?: {
        id: number;
        name: string;
    };
    status: string;
    emailVerified: boolean;
    createdAt: string;
}

export interface CreateBranchUserRequest {
    username: string;
    email: string;
    password: string;
    primaryBranchId?: number;
    role: string; // 'tenant_user' or 'tenant_admin'
}

export interface UpdateUserRequest {
    username?: string;
    email?: string;
    password?: string;
    primaryBranchId?: number | null;
    role?: string;
    status?: string;
}

export interface CheckUsernameResponse {
    available: boolean;
    message: string;
    suggestions?: string[];
}

// Check username availability
export const checkUsernameAvailability = async (username: string): Promise<CheckUsernameResponse> => {
    const response = await axiosInstance.get(`/users/check-username?username=${username}`);
    return response.data;
};

// Get all users for tenant
export const getUsers = async (): Promise<User[]> => {
    const response = await axiosInstance.get('/users');
    return response.data;
};

// Create branch user
export const createBranchUser = async (data: CreateBranchUserRequest): Promise<{ message: string; user: User }> => {
    const response = await axiosInstance.post('/users/create-branch-user', data);
    return response.data;
};

// Update user
export const updateUser = async (id: number, data: UpdateUserRequest): Promise<{ message: string }> => {
    const response = await axiosInstance.put(`/users/${id}`, data);
    return response.data;
};

// Delete user
export const deleteUser = async (id: number): Promise<{ message: string }> => {
    const response = await axiosInstance.delete(`/users/${id}`);
    return response.data;
};
