import axiosInstance from './axios-config';

// Fee Rule Types
export interface FeeRule {
    id: number;
    tenantId: number;
    name: string;
    description: string;
    minAmount: number;
    maxAmount?: number;
    sourceCurrency: string;
    destinationCountry: string;
    feeType: 'FLAT' | 'PERCENTAGE' | 'COMBINED';
    flatFee: number;
    percentageFee: number;
    minFee: number;
    maxFee?: number;
    priority: number;
    isActive: boolean;
    validFrom?: string;
    validUntil?: string;
    createdAt: string;
    updatedAt: string;
}

export interface FeeCalculationResult {
    totalFee: number;
    flatPortion: number;
    percentPortion: number;
    ruleApplied?: FeeRule;
    ruleName: string;
}

export interface CreateFeeRuleRequest {
    name: string;
    description?: string;
    minAmount: number;
    maxAmount?: number;
    sourceCurrency?: string;
    destinationCountry?: string;
    feeType: 'FLAT' | 'PERCENTAGE' | 'COMBINED';
    flatFee?: number;
    percentageFee?: number;
    minFee?: number;
    maxFee?: number;
    priority?: number;
    isActive?: boolean;
    validFrom?: string;
    validUntil?: string;
}

// Get all fee rules
export const getAllFeeRules = async (includeInactive?: boolean): Promise<FeeRule[]> => {
    const params = includeInactive ? { include_inactive: 'true' } : {};
    const response = await axiosInstance.get('/fees/rules', { params });
    return response.data;
};

// Get a specific fee rule by ID
export const getFeeRuleById = async (id: number): Promise<FeeRule> => {
    const response = await axiosInstance.get(`/fees/rules/${id}`);
    return response.data;
};

// Create a new fee rule
export const createFeeRule = async (data: CreateFeeRuleRequest): Promise<FeeRule> => {
    const response = await axiosInstance.post('/fees/rules', data);
    return response.data;
};

// Update an existing fee rule
export const updateFeeRule = async (id: number, data: Partial<CreateFeeRuleRequest>): Promise<FeeRule> => {
    const response = await axiosInstance.put(`/fees/rules/${id}`, data);
    return response.data;
};

// Delete (deactivate) a fee rule
export const deleteFeeRule = async (id: number): Promise<void> => {
    await axiosInstance.delete(`/fees/rules/${id}`);
};

// Create default fee rules for tenant
export const createDefaultFeeRules = async (): Promise<{ message: string }> => {
    const response = await axiosInstance.post('/fees/rules/defaults');
    return response.data;
};

// Calculate fee for a transaction
export const calculateFee = async (
    amount: number,
    sourceCurrency: string,
    destinationCountry: string
): Promise<FeeCalculationResult> => {
    const response = await axiosInstance.post('/fees/calculate', {
        amount,
        sourceCurrency,
        destinationCountry,
    });
    return response.data;
};

// Preview fee without creating transaction (GET request)
export const previewFee = async (
    amount: number,
    sourceCurrency?: string,
    destinationCountry?: string
): Promise<FeeCalculationResult> => {
    const params: Record<string, string> = { amount: amount.toString() };
    if (sourceCurrency) params.source_currency = sourceCurrency;
    if (destinationCountry) params.destination_country = destinationCountry;
    
    const response = await axiosInstance.get('/fees/preview', { params });
    return response.data;
};
