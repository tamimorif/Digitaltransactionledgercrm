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
 * Format input value as user types (for real-time formatting)
 * @param value - Current input value
 * @param allowDecimals - Whether to allow decimal places
 * @returns Formatted value
 */
export function formatAsUserTypes(value: string, allowDecimals: boolean = true): string {
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

    if (allowDecimals && parts.length > 1) {
        // Limit decimal places to 2
        const decimalPart = parts[1].substring(0, 2);
        result = `${integerPart}.${decimalPart}`;
    }

    // Add back negative sign
    if (isNegative) {
        result = `-${result}`;
    }

    return result;
}
