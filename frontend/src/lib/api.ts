const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface Transaction {
    id?: number;
    client_id: number;
    date: string;
    amount: number;
    currency: string;
    type: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Client {
    id?: number;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    created_at?: string;
    updated_at?: string;
}

class ApiClient {
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;

        const config: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // Transaction endpoints
    async getTransactions(): Promise<Transaction[]> {
        return this.request<Transaction[]>('/api/transactions');
    }

    async getTransaction(id: number): Promise<Transaction> {
        return this.request<Transaction>(`/api/transactions/${id}`);
    }

    async createTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
        return this.request<Transaction>('/api/transactions', {
            method: 'POST',
            body: JSON.stringify(transaction),
        });
    }

    async updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction> {
        return this.request<Transaction>(`/api/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(transaction),
        });
    }

    async deleteTransaction(id: number): Promise<void> {
        return this.request<void>(`/api/transactions/${id}`, {
            method: 'DELETE',
        });
    }

    // Client endpoints
    async getClients(): Promise<Client[]> {
        return this.request<Client[]>('/api/clients');
    }

    async getClient(id: number): Promise<Client> {
        return this.request<Client>(`/api/clients/${id}`);
    }

    async createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
        return this.request<Client>('/api/clients', {
            method: 'POST',
            body: JSON.stringify(client),
        });
    }

    async updateClient(id: number, client: Partial<Client>): Promise<Client> {
        return this.request<Client>(`/api/clients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(client),
        });
    }

    async deleteClient(id: number): Promise<void> {
        return this.request<void>(`/api/clients/${id}`, {
            method: 'DELETE',
        });
    }

    // Search endpoints
    async searchClients(query: string): Promise<Client[]> {
        return this.request<Client[]>(`/api/clients/search?q=${encodeURIComponent(query)}`);
    }

    async searchTransactions(query: string): Promise<Transaction[]> {
        return this.request<Transaction[]>(`/api/transactions/search?q=${encodeURIComponent(query)}`);
    }
}

export const api = new ApiClient();