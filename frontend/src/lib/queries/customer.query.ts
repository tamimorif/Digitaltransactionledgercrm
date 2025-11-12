import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    searchCustomers,
    getCustomerByPhone,
    findOrCreateCustomer,
    getCustomersForTenant,
    updateCustomer,
    searchCustomersGlobal,
    getCustomerWithTenants,
} from '../customer-api';
import { FindOrCreateCustomerRequest, UpdateCustomerRequest } from '../models/customer.model';

// Search customers
export const useSearchCustomers = (query: string) => {
    return useQuery({
        queryKey: ['customers', 'search', query],
        queryFn: () => searchCustomers(query),
        enabled: !!query && query.length >= 3, // Only search if 3+ characters
    });
};

// Get customer by phone
export const useGetCustomerByPhone = (phone: string) => {
    return useQuery({
        queryKey: ['customer', 'phone', phone],
        queryFn: () => getCustomerByPhone(phone),
        enabled: !!phone,
    });
};

// Get all customers for tenant
export const useGetCustomersForTenant = () => {
    return useQuery({
        queryKey: ['customers', 'tenant'],
        queryFn: getCustomersForTenant,
    });
};

// Find or create customer
export const useFindOrCreateCustomer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: FindOrCreateCustomerRequest) => findOrCreateCustomer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
};

// Update customer
export const useUpdateCustomer = (id: number) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateCustomerRequest) => updateCustomer(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['customer', id] });
        },
    });
};

// ============ SUPER ADMIN HOOKS ============

// Search customers globally (SuperAdmin only)
export const useSearchCustomersGlobal = (query: string) => {
    return useQuery({
        queryKey: ['customers', 'global', 'search', query],
        queryFn: () => searchCustomersGlobal(query),
        enabled: !!query && query.length >= 3,
    });
};

// Get customer with tenant links (SuperAdmin only)
export const useGetCustomerWithTenants = (id: number) => {
    return useQuery({
        queryKey: ['customer', 'global', id],
        queryFn: () => getCustomerWithTenants(id),
        enabled: !!id,
    });
};
