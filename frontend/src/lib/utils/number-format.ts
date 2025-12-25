/**
 * Format a number with thousand separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas
 */
export function formatNumberWithCommas(value: number | string, decimals: number = 2): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) return '';

    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * Remove commas from a formatted number string
 * @param value - Formatted string with commas
 * @returns Plain number string
 */
export function removeCommas(value: string): string {
    return value.replace(/,/g, '');
}

/**
 * Parse a formatted number string to a float
 * @param value - Formatted string with commas
 * @returns Parsed number
 */
export function parseFormattedNumber(value: string): number {
    const cleaned = removeCommas(value);
    return parseFloat(cleaned) || 0;
}

/**
 * Get number of decimals based on currency
 * @param currency - Currency code (e.g., 'USD', 'IRR')
 * @returns Number of decimal places (0 for IRR, 2 for others)
 */
export function getCurrencyDecimals(currency: string): number {
    const upper = currency.toUpperCase();
    if (upper === 'IRR' || upper === 'TOMAN' || upper === 'JPY') return 0;
    if (upper === 'BTC' || upper === 'ETH') return 8; // Crypto usually 8
    if (upper === 'USDT' || upper === 'USDC') return 6; // Stablecoins often 6 or 2
    return 2;
}

/**
 * Format a number according to currency rules
 * @param value - The value to format
 * @param currency - Currency code
 * @returns Formatted string
 */
export function formatCurrency(value: number | string, currency: string = ''): string {
    const decimals = getCurrencyDecimals(currency);
    return formatNumberWithCommas(value, decimals);
}

/**
 * Format input value as user types (for real-time formatting)
 * @param value - Current input value
 * @param allowDecimals - Whether to allow decimal places (or pass number for max decimals)
 * @returns Formatted value
 */
export function formatAsUserTypes(value: string, allowDecimals: boolean | number = true): string {
    const maxDecimals = typeof allowDecimals === 'number' ? allowDecimals : (allowDecimals ? 2 : 0);
    const shouldAllow = maxDecimals > 0;

    // Remove all non-numeric characters except decimal point and minus
    let cleaned = value.replace(/[^\d.-]/g, '');

    // Handle negative sign
    const isNegative = cleaned.startsWith('-');
    if (isNegative) {
        cleaned = cleaned.substring(1);
    }

    // Split by decimal point
    const parts = cleaned.split('.');

    // Format the integer part with commas
    let integerPart = parts[0];

    // Add commas to integer part
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Reconstruct the number
    let result = integerPart;

    if (shouldAllow && parts.length > 1) {
        // Limit decimal places
        const decimalPart = parts[1].substring(0, maxDecimals);
        result = `${integerPart}.${decimalPart}`;
    } else if (shouldAllow && value.endsWith('.')) {
        // Allow typing the decimal point
        result = `${integerPart}.`;
    }

    // Add back negative sign
    if (isNegative) {
        result = `-${result}`;
    }

    return result;
}

