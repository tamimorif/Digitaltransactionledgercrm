/**
 * Format a number with thousands separators (commas)
 * @param value - Number or string to format
 * @returns Formatted string with commas (e.g., "1,000,000")
 */
export function formatNumberWithCommas(value: number | string): string {
    if (!value) return '';

    // Convert to string and remove any existing commas
    const numStr = value.toString().replace(/,/g, '');

    // Check if it's a valid number
    if (isNaN(Number(numStr))) return value.toString();

    // Split into integer and decimal parts
    const parts = numStr.split('.');

    // Add commas to integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Join back with decimal if exists
    return parts.join('.');
}

/**
 * Format a number with thousands separators
 * Alias for formatNumberWithCommas for convenience
 */
export function formatNumber(value: number | string): string {
    return formatNumberWithCommas(value);
}

/**
 * Remove commas from a formatted number string
 * @param value - Formatted string with commas
 * @returns Number without commas
 */
export function parseFormattedNumber(value: string): string {
    if (!value) return '';
    return value.replace(/,/g, '');
}

/**
 * Format currency amount with commas and decimal places
 * @param amount - Amount to format
 * @param currency - Currency code (e.g., 'CAD', 'USD', 'IRR')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | string, currency?: string, decimals: number = 2): string {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;

    if (isNaN(num)) return '0.00';

    const formatted = formatNumberWithCommas(num.toFixed(decimals));

    if (currency) {
        // Currency symbols
        const symbols: Record<string, string> = {
            CAD: '$',
            USD: '$',
            EUR: '€',
            GBP: '£',
            IRR: '﷼',
        };
        const symbol = symbols[currency] || currency + ' ';
        return `${symbol}${formatted}`;
    }

    return formatted;
}

/**
 * Handle input change for formatted number fields
 * Only allows numbers, commas, and decimal points
 * @param value - Current input value
 * @returns Clean formatted value
 */
export function handleNumberInput(value: string): string {
    // Remove any non-digit, non-comma, non-decimal characters
    let cleaned = value.replace(/[^\d.,]/g, '');

    // Remove commas temporarily
    cleaned = cleaned.replace(/,/g, '');

    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Format with commas
    return formatNumberWithCommas(cleaned);
}

/**
 * Format a date string to a readable format
 * @param dateStr - ISO date string
 * @returns Formatted date string (e.g., "Oct 25, 2023 14:30")
 */
export function formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
