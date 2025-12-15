// Remittance type definitions for the hawala-style money transfer system

export interface OutgoingRemittance {
  id: number;
  tenantId: number;
  branchId?: number;
  remittanceCode: string;
  
  // Sender (in Canada)
  senderName: string;
  senderPhone: string;
  senderEmail?: string;
  
  // Recipient (in Iran)
  recipientName: string;
  recipientPhone?: string;
  recipientIban?: string;
  recipientBank?: string;
  recipientAddress?: string;
  
  // Financial details
  amountIrr: number; // Amount in Toman
  buyRateCad: number; // Exchange rate (Toman per CAD)
  equivalentCad: number; // Auto-calculated CAD amount
  receivedCad: number; // Amount received from customer
  feeCAD: number;
  
  // Settlement tracking
  settledAmountIrr: number;
  remainingIrr: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  
  // Profit tracking
  totalProfitCad: number;
  totalCostCad: number;
  
  // Notes
  notes?: string;
  internalNotes?: string;
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  
  // Relations
  settlements?: RemittanceSettlement[];
  branch?: Branch;
  creator?: User;
  
  // Cancellation
  cancelledAt?: string;
  cancelledBy?: number;
  cancellationReason?: string;
}

export interface IncomingRemittance {
  id: number;
  tenantId: number;
  branchId?: number;
  remittanceCode: string;
  
  // Sender (in Iran)
  senderName: string;
  senderPhone: string;
  senderIban?: string;
  senderBank?: string;
  
  // Recipient (in Canada)
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientAddress?: string;
  
  // Financial details
  amountIrr: number; // Amount in Toman
  sellRateCad: number; // Exchange rate (Toman per CAD)
  equivalentCad: number; // CAD to pay recipient
  paidCad: number;
  feeCAD: number;
  
  // Settlement tracking
  allocatedIrr: number;
  remainingIrr: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'PAID' | 'CANCELLED';
  
  // Payment tracking
  paymentMethod: 'CASH' | 'E_TRANSFER' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  paymentReference?: string;
  paidAt?: string;
  paidBy?: number;
  
  // Notes
  notes?: string;
  internalNotes?: string;
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  
  // Relations
  settlements?: RemittanceSettlement[];
  branch?: Branch;
  creator?: User;
  
  // Cancellation
  cancelledAt?: string;
  cancelledBy?: number;
  cancellationReason?: string;
}

export interface RemittanceSettlement {
  id: number;
  tenantId: number;
  outgoingRemittanceId: number;
  incomingRemittanceId: number;
  
  settledAmountIrr: number;
  outgoingBuyRate: number;
  incomingSellRate: number;
  profitCad: number;
  
  notes?: string;
  createdAt: string;
  createdBy: number;
  
  // Relations
  outgoingRemittance?: OutgoingRemittance;
  incomingRemittance?: IncomingRemittance;
  creator?: User;
}

// Request/Form types
export interface CreateOutgoingRemittanceRequest {
  senderName: string;
  senderPhone: string;
  senderEmail?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientIban?: string;
  recipientBank?: string;
  recipientAddress?: string;
  amountIrr: number;
  buyRateCad: number;
  receivedCad: number;
  feeCAD?: number;
  notes?: string;
  internalNotes?: string;
}

export interface CreateIncomingRemittanceRequest {
  senderName: string;
  senderPhone: string;
  senderIban?: string;
  senderBank?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientAddress?: string;
  amountIrr: number;
  sellRateCad: number;
  feeCAD?: number;
  notes?: string;
  internalNotes?: string;
}

export interface CreateSettlementRequest {
  outgoingRemittanceId: number;
  incomingRemittanceId: number;
  amountIrr: number;
  notes?: string;
}

export interface MarkAsPaidRequest {
  paymentMethod: 'CASH' | 'E_TRANSFER' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  paymentReference?: string;
}

export interface CancelRemittanceRequest {
  reason: string;
}

// Filter types
export interface RemittanceFilters {
  status?: string;
  branchId?: number;
  startDate?: string;
  endDate?: string;
}

// Profit summary
export interface ProfitSummary {
  totalProfitCAD: number;
  totalSettlements: number;
  averageProfitCAD: number;
}

// Supporting types
interface Branch {
  id: number;
  name: string;
  location?: string;
}

interface User {
  id: number;
  email: string;
  name?: string;
}

// Helper types for settlement preview
export interface SettlementPreview {
  outgoing: OutgoingRemittance;
  incoming: IncomingRemittance;
  settlementAmount: number;
  calculatedProfit: number;
  profitMargin: number;
  afterSettlement: {
    outgoingRemaining: number;
    outgoingStatus: OutgoingRemittance['status'];
    incomingRemaining: number;
    incomingStatus: IncomingRemittance['status'];
  };
}

// Status badge colors
export const REMITTANCE_STATUS_COLORS = {
  PENDING: 'red',
  PARTIAL: 'orange',
  COMPLETED: 'green',
  PAID: 'blue',
  CANCELLED: 'gray',
} as const;

// Status labels
export const REMITTANCE_STATUS_LABELS = {
  PENDING: 'Pending',
  PARTIAL: 'Partially Settled',
  COMPLETED: 'Completed',
  PAID: 'Paid to Recipient',
  CANCELLED: 'Cancelled',
} as const;

// Payment method labels
export const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash',
  E_TRANSFER: 'E-Transfer',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
} as const;
