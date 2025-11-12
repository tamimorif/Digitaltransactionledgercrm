export interface TransactionStatistics {
    totalCount: number;
    totalVolumeByCurrency: Record<string, number>;
    countByType: Record<string, number>;
    countByCurrency: Record<string, number>;
    averageAmount: number;
    dateRange: string;
}

export interface TransactionExportRow {
    id: string;
    date: string;
    type: string;
    sendCurrency: string;
    sendAmount: number;
    receiveCurrency: string;
    receiveAmount: number;
    rateApplied: number;
    feeCharged: number;
    beneficiaryName: string;
    beneficiaryPhone: string;
    beneficiaryBank: string;
    beneficiaryAccount: string;
    branchName: string;
    status: string;
    notes: string;
}

export interface StatisticsFilters {
    branchId?: number;
    startDate?: string;
    endDate?: string;
}
