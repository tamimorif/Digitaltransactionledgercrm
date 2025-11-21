export interface LedgerEntry {
    id: number;
    tenantId: number;
    clientId: string;
    branchId?: number;
    transactionId?: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'EXCHANGE_IN' | 'EXCHANGE_OUT' | 'SETTLEMENT';
    currency: string;
    amount: number;
    description: string;
    exchangeRate?: number;
    relatedEntryId?: number;
    createdAt: string;
    createdBy: number;

    // Optional expanded fields
    branch?: {
        id: number;
        name: string;
    };
}

export interface CreateLedgerEntryRequest {
    type: 'DEPOSIT' | 'WITHDRAWAL';
    currency: string;
    amount: number;
    description: string;
}

export interface ExchangeRequest {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    rate: number;
    description: string;
}

export interface LedgerBalance {
    [currency: string]: number;
}
