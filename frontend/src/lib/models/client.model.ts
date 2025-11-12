// ==================== Client Types ====================

export interface Client {
  id: number;
  name: string;
  phoneNumber: string;
  email: string;
  joinDate: string;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  name: string;
  phone_number: string;
  email?: string;
}

export interface UpdateClientRequest {
  name?: string;
  phone_number?: string;
  email?: string;
}

// ==================== Transaction Types ====================

export interface Transaction {
  id: string;
  clientId: string;
  tenantId: number;
  type: 'CASH_EXCHANGE' | 'BANK_TRANSFER' | 'MONEY_PICKUP' | 'WALK_IN_CUSTOMER';
  sendCurrency: string;
  sendAmount: number;
  receiveCurrency: string;
  receiveAmount: number;
  rateApplied: number;
  feeCharged: number;
  beneficiaryName?: string;
  beneficiaryDetails?: string;
  userNotes?: string;
  isEdited?: boolean;
  lastEditedAt?: string;
  editHistory?: string;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  clientId: string;
  type: 'CASH_EXCHANGE' | 'BANK_TRANSFER' | 'MONEY_PICKUP' | 'WALK_IN_CUSTOMER';
  sendCurrency: string;
  sendAmount: number;
  receiveCurrency: string;
  receiveAmount: number;
  rateApplied: number;
  feeCharged: number;
  beneficiaryName?: string;
  beneficiaryDetails?: string;
  userNotes?: string;
  transactionDate?: string;
}

export interface UpdateTransactionRequest {
  type?: 'CASH_EXCHANGE' | 'BANK_TRANSFER' | 'MONEY_PICKUP' | 'WALK_IN_CUSTOMER';
  sendCurrency?: string;
  sendAmount?: number;
  receiveCurrency?: string;
  receiveAmount?: number;
  rateApplied?: number;
  feeCharged?: number;
  beneficiaryName?: string;
  beneficiaryDetails?: string;
  userNotes?: string;
  transactionDate?: string;
}

export interface ClientWithTransactions extends Client {
  transactions: Transaction[];
}
