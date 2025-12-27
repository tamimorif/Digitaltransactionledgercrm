/**
 * Centralized constants for the application
 * Use these constants instead of hardcoding values throughout the codebase
 */

// =============================================================================
// API & Storage
// =============================================================================

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
const NORMALIZED_API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');
export const API_BASE_URL = NORMALIZED_API_BASE_URL.endsWith('/api')
    ? NORMALIZED_API_BASE_URL
    : `${NORMALIZED_API_BASE_URL}/api`;

// Standardized storage keys - USE THESE EVERYWHERE
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    USER: 'user',
    TENANT: 'tenant',
} as const;

// =============================================================================
// Currencies
// =============================================================================

export const CURRENCIES = ['CAD', 'IRR', 'TOMAN', 'USD', 'EUR', 'GBP', 'AED', 'TRY', 'USDT', 'BTC', 'ETH'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    CAD: '$',
    USD: '$',
    EUR: '€',
    GBP: '£',
    IRR: '﷼',
    TOMAN: 'T',
    AED: 'dh',
    TRY: '₺',
    USDT: '₮',
    BTC: '₿',
    ETH: 'Ξ',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
    CAD: 'Canadian Dollar',
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    IRR: 'Iranian Rial',
    TOMAN: 'Iranian Toman',
    AED: 'UAE Dirham',
    TRY: 'Turkish Lira',
    USDT: 'Tether (USDT)',
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
};

// =============================================================================
// Payment Methods
// =============================================================================

export const PAYMENT_METHODS = [
    'CASH',
    'E_TRANSFER',
    'BANK_TRANSFER',
    'CHEQUE',
    'CARD',
    'ONLINE',
    'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    CASH: 'Cash',
    E_TRANSFER: 'E-Transfer',
    BANK_TRANSFER: 'Bank Transfer',
    CHEQUE: 'Cheque',
    CARD: 'Debit/Credit Card',
    ONLINE: 'Online Payment',
    OTHER: 'Other',
};

// =============================================================================
// Transaction & Payment Statuses
// =============================================================================

export const TRANSACTION_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const PAYMENT_STATUSES = ['SINGLE', 'OPEN', 'PARTIAL', 'FULLY_PAID'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REMITTANCE_STATUSES = ['PENDING', 'PARTIAL', 'COMPLETED', 'PAID', 'CANCELLED'] as const;
export type RemittanceStatus = (typeof REMITTANCE_STATUSES)[number];

export const PICKUP_STATUSES = ['PENDING', 'PICKED_UP', 'CANCELLED'] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

// =============================================================================
// User Roles
// =============================================================================

export const USER_ROLES = ['superadmin', 'tenant_owner', 'tenant_admin', 'tenant_user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// =============================================================================
// Transaction Types
// =============================================================================

export const TRANSACTION_TYPES = [
    'CASH_EXCHANGE',
    'BANK_TRANSFER',
    'MONEY_PICKUP',
    'WALK_IN_CUSTOMER',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// =============================================================================
// Pickup Transaction Types
// =============================================================================

export const PICKUP_TRANSACTION_TYPES = [
    'CASH_PICKUP',
    'CARD_SWAP_IRR',
    'CARD_SWAP_CAD',
    'INCOMING_FUNDS',
] as const;
export type PickupTransactionType = (typeof PICKUP_TRANSACTION_TYPES)[number];

// =============================================================================
// Formatting & Thresholds
// =============================================================================

export const FLOAT_TOLERANCE = 0.01;
export const FULL_PAYMENT_THRESHOLD = 0.99; // 99% = considered full

// Number formatting options
export const NUMBER_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
};

// =============================================================================
// Pagination
// =============================================================================

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
