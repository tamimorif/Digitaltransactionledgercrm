import {
    OutgoingRemittance,
    IncomingRemittance,
    RemittanceSettlement,
    CreateOutgoingRemittanceRequest,
    CreateIncomingRemittanceRequest,
    CreateSettlementRequest,
    MarkAsPaidRequest,
    CancelRemittanceRequest,
    RemittanceFilters,
    ProfitSummary,
} from '../models/remittance';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class RemittanceApiClient {
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;

        // Get token from localStorage or cookie
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        const config: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
        };

        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // ==================== Outgoing Remittances ====================

    /**
     * Create a new outgoing remittance (Canada → Iran)
     */
    async createOutgoing(data: CreateOutgoingRemittanceRequest): Promise<OutgoingRemittance> {
        return this.request<OutgoingRemittance>('/api/remittances/outgoing', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Get all outgoing remittances with optional filters
     */
    async getOutgoing(filters?: RemittanceFilters): Promise<OutgoingRemittance[]> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.branchId) params.append('branchId', filters.branchId.toString());
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);

        const queryString = params.toString();
        const url = queryString ? `/api/remittances/outgoing?${queryString}` : '/api/remittances/outgoing';

        return this.request<OutgoingRemittance[]>(url);
    }

    /**
     * Get detailed information about a specific outgoing remittance
     */
    async getOutgoingDetails(id: number): Promise<OutgoingRemittance> {
        return this.request<OutgoingRemittance>(`/api/remittances/outgoing/${id}`);
    }

    /**
     * Cancel an outgoing remittance
     */
    async cancelOutgoing(id: number, data: CancelRemittanceRequest): Promise<{ message: string }> {
        return this.request(`/api/remittances/outgoing/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ==================== Incoming Remittances ====================

    /**
     * Create a new incoming remittance (Iran → Canada)
     */
    async createIncoming(data: CreateIncomingRemittanceRequest): Promise<IncomingRemittance> {
        return this.request<IncomingRemittance>('/api/remittances/incoming', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Get all incoming remittances with optional filters
     */
    async getIncoming(filters?: RemittanceFilters): Promise<IncomingRemittance[]> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.branchId) params.append('branchId', filters.branchId.toString());
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);

        const queryString = params.toString();
        const url = queryString ? `/api/remittances/incoming?${queryString}` : '/api/remittances/incoming';

        return this.request<IncomingRemittance[]>(url);
    }

    /**
     * Get detailed information about a specific incoming remittance
     */
    async getIncomingDetails(id: number): Promise<IncomingRemittance> {
        return this.request<IncomingRemittance>(`/api/remittances/incoming/${id}`);
    }

    /**
     * Mark an incoming remittance as paid to recipient
     */
    async markAsPaid(id: number, data: MarkAsPaidRequest): Promise<{ message: string }> {
        return this.request(`/api/remittances/incoming/${id}/mark-paid`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Cancel an incoming remittance
     */
    async cancelIncoming(id: number, data: CancelRemittanceRequest): Promise<{ message: string }> {
        return this.request(`/api/remittances/incoming/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ==================== Settlements ====================

    /**
     * Create a settlement between outgoing and incoming remittances
     */
    async createSettlement(data: CreateSettlementRequest): Promise<RemittanceSettlement> {
        return this.request<RemittanceSettlement>('/api/remittances/settle', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ==================== Reports & Analytics ====================

    /**
     * Get profit/loss summary
     */
    async getProfitSummary(startDate?: string, endDate?: string): Promise<ProfitSummary> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const queryString = params.toString();
        const url = queryString ? `/api/remittances/profit-summary?${queryString}` : '/api/remittances/profit-summary';

        return this.request<ProfitSummary>(url);
    }

    // ==================== Helper Methods ====================

    /**
     * Calculate profit preview for a potential settlement
     */
    calculateProfitPreview(
        outgoing: OutgoingRemittance,
        incoming: IncomingRemittance,
        settlementAmount: number
    ): {
        costCad: number;
        revenueCad: number;
        profitCad: number;
        profitMargin: number;
    } {
        const costCad = settlementAmount / outgoing.buyRateCad;
        const revenueCad = settlementAmount / incoming.sellRateCad;
        const profitCad = costCad - revenueCad;
        const profitMargin = (profitCad / costCad) * 100;

        return {
            costCad,
            revenueCad,
            profitCad,
            profitMargin,
        };
    }

    /**
     * Format currency amount
     */
    formatCurrency(amount: number, currency: 'CAD' | 'IRR' = 'CAD'): string {
        if (currency === 'CAD') {
            return new Intl.NumberFormat('en-CA', {
                style: 'currency',
                currency: 'CAD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amount);
        } else {
            // Format Toman with Persian separators
            return new Intl.NumberFormat('fa-IR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount) + ' ریال';
        }
    }

    /**
     * Get settlement percentage for outgoing remittance
     */
    getSettlementPercentage(outgoing: OutgoingRemittance): number {
        if (outgoing.amountIrr === 0) return 0;
        return (outgoing.settledAmountIrr / outgoing.amountIrr) * 100;
    }

    /**
     * Get allocation percentage for incoming remittance
     */
    getAllocationPercentage(incoming: IncomingRemittance): number {
        if (incoming.amountIrr === 0) return 0;
        return (incoming.allocatedIrr / incoming.amountIrr) * 100;
    }
}

export const remittanceApi = new RemittanceApiClient();
