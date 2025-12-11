/**
 * @deprecated This file is deprecated. Use the React Query hooks from './queries/' instead.
 * 
 * This legacy API client is kept for backward compatibility.
 * New code should use:
 * - apiClient from './api-client' for direct axios calls
 * - React Query hooks from './queries/' for data fetching
 */

import apiClient from './api-client';

export interface Transaction {
  id?: string;
  client_id: string;
  date: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  type: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

class ApiClient {
  // Transaction endpoints
  async getTransactions(): Promise<Transaction[]> {
    const response = await apiClient.get<Transaction[]>('/transactions');
    return response.data;
  }

  async getTransaction(id: string): Promise<Transaction> {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`);
    return response.data;
  }

  async createTransaction(
    transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Transaction> {
    const response = await apiClient.post<Transaction>('/transactions', transaction);
    return response.data;
  }

  async updateTransaction(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
    const response = await apiClient.put<Transaction>(`/transactions/${id}`, transaction);
    return response.data;
  }

  async deleteTransaction(id: string): Promise<void> {
    await apiClient.delete(`/transactions/${id}`);
  }

  // Client endpoints
  async getClients(): Promise<Client[]> {
    const response = await apiClient.get<Client[]>('/clients');
    return response.data;
  }

  async getClient(id: string): Promise<Client> {
    const response = await apiClient.get<Client>(`/clients/${id}`);
    return response.data;
  }

  async createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
    const response = await apiClient.post<Client>('/clients', client);
    return response.data;
  }

  async updateClient(id: string, client: Partial<Client>): Promise<Client> {
    const response = await apiClient.put<Client>(`/clients/${id}`, client);
    return response.data;
  }

  async deleteClient(id: string): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  }

  // Search endpoints
  async searchClients(query: string): Promise<Client[]> {
    const response = await apiClient.get<Client[]>(`/clients/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  async searchTransactions(query: string): Promise<Transaction[]> {
    const response = await apiClient.get<Transaction[]>(
      `/transactions/search?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }
}

export const api = new ApiClient();
