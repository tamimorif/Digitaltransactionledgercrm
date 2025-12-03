/**
 * Format exchange rate for display based on transaction type
 * For Card Swap: Shows as "80,300 Toman = 1 CAD" instead of "0.0000124..."
 */
export function formatExchangeRate(
    rate: string | number,
    fromCurrency: string,
    toCurrency: string,
    isCardSwap: boolean = false
): string {
    const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;

    if (isCardSwap && fromCurrency === 'IRR' && numRate > 0) {
        // For card swap, user enters rate as "80300" meaning 80,300 Toman = 1 CAD
        // Display it intuitively
        return `${numRate.toLocaleString()} ${fromCurrency} = 1 ${toCurrency}`;
    }

    return `1 ${fromCurrency} = ${numRate} ${toCurrency}`;
}

/**
 * Calculate received amount based on transaction type and currency
 * For IRR (Toman) as source: Always divides (200M Toman / 81,000 rate = CAD)
 * For other currencies: Multiplies (amount * rate)
 */
export function calculateReceivedAmount(
    amount: string | number,
    rate: string | number,
    isCardSwap: boolean = false,
    sourceCurrency?: string
): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;

    // For IRR (Toman) as source, always divide by rate
    // Example: 200,000,000 Toman / 81,000 (rate) = 2,469.14 CAD
    if (sourceCurrency === 'IRR' || isCardSwap) {
        return numAmount / numRate;
    } else {
        // Normal: amount * rate
        return numAmount * numRate;
    }
}

/**
 * Save rate to history for quick reuse
 */
export function saveRateToHistory(fromCurrency: string, toCurrency: string, rate: string) {
    const key = `rate_${fromCurrency}_${toCurrency}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');

    // Add to front, keep last 5
    history.unshift({
        rate,
        timestamp: new Date().toISOString(),
    });

    localStorage.setItem(key, JSON.stringify(history.slice(0, 5)));
}

/**
 * Get rate history for a currency pair
 */
export function getRateHistory(fromCurrency: string, toCurrency: string): Array<{ rate: string; timestamp: string }> {
    const key = `rate_${fromCurrency}_${toCurrency}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
}

/**
 * Get the last used rate for a currency pair
 */
export function getLastRate(fromCurrency: string, toCurrency: string): string | null {
    const history = getRateHistory(fromCurrency, toCurrency);
    return history.length > 0 ? history[0].rate : null;
}

/**
 * Detect duplicate transaction within timeframe
 */
export function findDuplicateTransaction(
    senderName: string,
    amount: string,
    currency: string,
    recentTransactions: any[],
    timeframeMinutes: number = 10
): any | null {
    const now = new Date();
    const threshold = new Date(now.getTime() - timeframeMinutes * 60000);

    return recentTransactions.find(tx => {
        const txDate = new Date(tx.createdAt);
        const amountMatch = Math.abs(parseFloat(amount) - parseFloat(tx.amount)) < 0.01;
        const nameMatch = tx.senderName.toLowerCase() === senderName.toLowerCase();
        const currencyMatch = tx.currency === currency;
        const withinTimeframe = txDate >= threshold;

        return amountMatch && nameMatch && currencyMatch && withinTimeframe;
    });
}

/**
 * Format time ago for duplicate detection
 */
export function formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
}
