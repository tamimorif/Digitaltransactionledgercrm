import axiosInstance from './axios-config';
import {
    Customer,
    CustomerSearchResult,
    FindOrCreateCustomerRequest,
    UpdateCustomerRequest,
} from './models/customer.model';

// Search customers by phone or name
export const searchCustomers = async (query: string): Promise<Customer[]> => {
    const response = await axiosInstance.get('/customers/search', {
        params: { q: query },
    });
    return response.data;
};

// Get customer by phone
export const getCustomerByPhone = async (phone: string): Promise<Customer> => {
    const response = await axiosInstance.get(`/customers/phone/${phone}`);
    return response.data;
};

// Find or create customer and link to tenant
export const findOrCreateCustomer = async (
    data: FindOrCreateCustomerRequest
): Promise<Customer> => {
    const response = await axiosInstance.post('/customers/find-or-create', data);
    return response.data;
};

// Get all customers for tenant
export const getCustomersForTenant = async (): Promise<Customer[]> => {
    const response = await axiosInstance.get('/customers');
    return response.data;
};

// Update customer
export const updateCustomer = async (
    id: number,
    data: UpdateCustomerRequest
): Promise<{ message: string }> => {
    const response = await axiosInstance.put(`/customers/${id}`, data);
    return response.data;
};

// ============ SUPER ADMIN ENDPOINTS ============

// Search customers globally (SuperAdmin only)
export const searchCustomersGlobal = async (query: string): Promise<CustomerSearchResult[]> => {
    const response = await axiosInstance.get('/admin/customers/search', {
        params: { q: query },
    });
    return response.data;
};

// Get customer with all tenant links (SuperAdmin only)
export const getCustomerWithTenants = async (id: number): Promise<Customer> => {
    const response = await axiosInstance.get(`/admin/customers/${id}`);
    return response.data;
};
