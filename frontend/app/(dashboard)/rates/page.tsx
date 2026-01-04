'use client';

import { useMemo, useState } from 'react';
import {
    useGetRates,
    useRefreshRates,
    useSetCustomRate,
    useGetScrapedRates,
    useRefreshScrapedRates,
    useGetNavasanRates,
    type ExchangeRate,
    type ScrapedRate,
} from '@/src/lib/queries/exchange-rate.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/src/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import { Badge } from '@/src/components/ui/badge';
import { RefreshCw, Plus, Loader2, TrendingUp, ArrowRightLeft, ArrowDown, ArrowUp, Globe, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

// Currencies relevant for Hawala/Sarafi business
const RELEVANT_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'AED', 'TRY', 'CNY', 'USDT', 'BTC', 'ETH', 'XRP', 'TRX'];

const CURRENCY_INFO: Record<string, { name: string; symbol: string; flag: string }> = {
    CAD: { name: 'Canadian Dollar', symbol: '$', flag: '🇨🇦' },
    USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
    GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    IRR: { name: 'Iranian Rial (Toman)', symbol: '﷼', flag: '🇮🇷' },
    AED: { name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
    TRY: { name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
    CNY: { name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
    USDT: { name: 'Tether', symbol: '₮', flag: '₮' },
    BTC: { name: 'Bitcoin', symbol: '₿', flag: '₿' },
    ETH: { name: 'Ethereum', symbol: 'Ξ', flag: 'Ξ' },
    XRP: { name: 'Ripple', symbol: '✕', flag: '✕' },
    TRX: { name: 'Tron', symbol: '♦', flag: '♦' },
};

// Format number with commas
const formatWithCommas = (num: number, decimals: number = 0): string => {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

// Helper to get currency icon URL
const getCurrencyIcon = (currency: string) => {
    const code = currency.toLowerCase();

    // Crypto map
    const cryptoMap: Record<string, string> = {
        usdt: 'usdt',
        btc: 'btc',
        eth: 'eth',
        xrp: 'xrp',
        trx: 'trx',
    };

    if (cryptoMap[code]) {
        return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cryptoMap[code]}.png`;
    }

    // Country flags map (ISO 3166-1 alpha-2)
    const countryMap: Record<string, string> = {
        cad: 'ca',
        usd: 'us',
        eur: 'eu',
        gbp: 'gb',
        irr: 'ir',
        aed: 'ae',
        try: 'tr',
        cny: 'cn',
    };

    const countryCode = countryMap[code];
    return countryCode ? `https://flagcdn.com/w80/${countryCode}.png` : null;
};

// Define currency groups
const MAJOR_FIAT = ['USD', 'CAD', 'EUR'];

// Other currencies to display relative to CAD (including duplicates of USD/EUR as requested)
const OTHER_FIAT_CAD_PEGGED = ['USD', 'EUR', 'GBP', 'AED', 'TRY', 'CNY'];

// Crypto to display relative to USD
const CRYPTO_USD_PEGGED = ['USDT', 'BTC', 'ETH', 'XRP', 'TRX'];

export default function RatesPage() {
    const [openCustom, setOpenCustom] = useState(false);
    const [baseCurrency, setBaseCurrency] = useState('CAD');
    const [targetCurrency, setTargetCurrency] = useState('IRR');
    const [customBuyRate, setCustomBuyRate] = useState('');
    const [customSellRate, setCustomSellRate] = useState('');
    const [navasanFilter, setNavasanFilter] = useState('');

    const { data: rates, isLoading } = useGetRates();
    const { data: scrapedRatesData, isLoading: isLoadingScraped, error: scrapedError } = useGetScrapedRates();
    const { data: navasanRates, isLoading: isLoadingNavasan } = useGetNavasanRates();
    const refreshRates = useRefreshRates();
    const refreshScrapedRates = useRefreshScrapedRates();
    const setCustomRateMutation = useSetCustomRate();

    // Prepare OpenER Map for easy lookup
    const scrapedRatesMap: Record<string, ScrapedRate> = {};
    scrapedRatesData?.rates?.forEach((rate) => {
        scrapedRatesMap[rate.currency] = rate;
    });

    const handleRefreshRates = () => {
        refreshScrapedRates.mutate(undefined, {
            onSuccess: () => {
                toast.success('Live rates refreshed from ExchangeRate-API');
            },
            onError: () => {
                toast.error('Failed to refresh live rates');
            },
        });
    };

    const handleSetCustomRate = () => {
        const buyRate = parseFloat(customBuyRate.replace(/,/g, ''));
        const sellRate = parseFloat(customSellRate.replace(/,/g, ''));

        if (isNaN(buyRate) || buyRate <= 0 || isNaN(sellRate) || sellRate <= 0) {
            toast.error('Please enter valid buy and sell rates');
            return;
        }

        if (buyRate >= sellRate) {
            toast.error('Buy rate should be lower than sell rate for profit');
            return;
        }

        const midRate = (buyRate + sellRate) / 2;

        setCustomRateMutation.mutate(
            { baseCurrency, targetCurrency, rate: midRate },
            {
                onSuccess: () => {
                    toast.success(`Rates set: Buy ${formatWithCommas(buyRate)} / Sell ${formatWithCommas(sellRate)}`);
                    setOpenCustom(false);
                    setCustomBuyRate('');
                    setCustomSellRate('');
                },
                onError: () => {
                    toast.error('Failed to set custom rate');
                },
            }
        );
    };

    const navasanItems = useMemo(() => {
        const items = navasanRates?.items ?? [];
        const needle = navasanFilter.trim().toLowerCase();
        if (!needle) {
            return items;
        }

        return items.filter((item) => {
            const itemKey = item.item?.toLowerCase() ?? '';
            const fa = item.currency_fa?.toLowerCase() ?? '';
            return itemKey.includes(needle) || fa.includes(needle);
        });
    }, [navasanFilter, navasanRates?.items]);

    const formatRawValue = (value: string) => {
        const cleaned = value.replace(/,/g, '');
        const numeric = Number.parseFloat(cleaned);
        if (!Number.isFinite(numeric)) {
            return value;
        }
        return numeric.toLocaleString();
    };

    // Filter rates to only show relevant currencies
    const filteredRates = rates?.filter(
        (rate) =>
            RELEVANT_CURRENCIES.includes(rate.baseCurrency) &&
            RELEVANT_CURRENCIES.includes(rate.targetCurrency)
    );

    // Helper to render a rate card
    const renderRateCard = (currency: string, type: 'TOMAN' | 'CROSS_CAD' | 'CROSS_USD') => {
        const info = CURRENCY_INFO[currency];
        const scrapedRate = scrapedRatesMap[currency];
        const cadRate = scrapedRatesMap['CAD'];
        const usdRate = scrapedRatesMap['USD'];

        // If rate is temporarily unavailable (no scraped data), filtering logic requests to HIDE it.
        // So we return null if no scraped rate exists.
        if (!scrapedRate) return null;

        let buyDisplay = '—';
        let sellDisplay = '—';
        let unit = '';

        // Logic based on types
        if (type === 'TOMAN') {
            if (!scrapedRate) return null;
            buyDisplay = scrapedRate.buy_rate_formatted;
            sellDisplay = scrapedRate.sell_rate_formatted;
            unit = 'T';
        } else if (type === 'CROSS_CAD') {
            // Use standard ExchangeRate-API (Google/XE style) rates relative to CAD
            // Find rate where Base=CAD, Target=Currency
            const standardRate = rates?.find(r => r.baseCurrency === 'CAD' && r.targetCurrency === currency);

            if (standardRate && standardRate.rate > 0) {
                // Standard API usually gives Mid rate. Show same for Buy/Sell or apply small spread if desired?
                // User asked for "Google rates", so Mid is safest.
                buyDisplay = formatWithCommas(standardRate.rate, 4);
                sellDisplay = formatWithCommas(standardRate.rate, 4);
                unit = 'CAD';
            } else {
                // Fallback to calculation if standard API missing
                if (scrapedRate && cadRate && parseFloat(cadRate.buy_rate) > 0) {
                    const buy = parseFloat(scrapedRate.buy_rate) / parseFloat(cadRate.buy_rate);
                    const sell = parseFloat(scrapedRate.sell_rate) / parseFloat(cadRate.sell_rate);
                    buyDisplay = formatWithCommas(buy, 4);
                    sellDisplay = formatWithCommas(sell, 4);
                    unit = 'CAD';
                } else {
                    return null;
                }
            }
        } else if (type === 'CROSS_USD') {
            // Use standard ExchangeRate-API (Google/XE style) rates relative to USD
            const standardRate = rates?.find(r => r.baseCurrency === 'USD' && r.targetCurrency === currency);

            if (standardRate && standardRate.rate > 0) {
                buyDisplay = formatWithCommas(standardRate.rate, 4);
                sellDisplay = formatWithCommas(standardRate.rate, 4);
                unit = 'USD';
            } else {
                // Fallback
                if (scrapedRate && usdRate && parseFloat(usdRate.buy_rate) > 0) {
                    const buy = parseFloat(scrapedRate.buy_rate) / parseFloat(usdRate.buy_rate);
                    const sell = parseFloat(scrapedRate.sell_rate) / parseFloat(usdRate.sell_rate);
                    buyDisplay = formatWithCommas(buy, 4);
                    sellDisplay = formatWithCommas(sell, 4);
                    unit = 'USD';
                } else {
                    return null;
                }
            }
        }

        if (buyDisplay === '—') return null; // Double check availability

        const iconUrl = getCurrencyIcon(currency);

        return (
            <Card key={`${currency}-${type}`} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        {iconUrl ? (
                            <img src={iconUrl} alt={currency} className="w-8 h-8 object-contain" />
                        ) : (
                            <span className="text-2xl">{info.flag}</span>
                        )}
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{currency}</span>
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">Live</Badge>
                            </div>
                            <p className="text-xs font-normal text-muted-foreground mr-2">
                                {scrapedRate?.currency_fa || info.name}
                            </p>
                        </div>
                        <span className="text-xl font-bold text-muted-foreground opacity-20">{info.symbol}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                        <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                            <ArrowUp className="h-3 w-3" /> Buy
                        </span>
                        <span className="font-mono font-medium text-sm">
                            {buyDisplay} {unit}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/30 rounded">
                        <span className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                            <ArrowDown className="h-3 w-3" /> Sell
                        </span>
                        <span className="font-mono font-medium text-sm">
                            {sellDisplay} {unit}
                        </span>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Exchange Rates</h1>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleRefreshRates} disabled={refreshScrapedRates.isPending} variant="outline">
                        {refreshScrapedRates.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Refresh Live Rates
                    </Button>
                    {/* Custom Rate Dialog omitted for brevity but kept in state logic if needed elsewhere later */}
                </div>
            </div>

            {
                isLoading || isLoadingScraped ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {scrapedError && (
                            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                                <CardContent className="py-3 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm text-amber-700 dark:text-amber-400">
                                        Could not fetch live rates. Using cached rates.
                                    </span>
                                </CardContent>
                            </Card>
                        )}

                        {/* Primary Rates (Toman) */}
                        <section>
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Globe className="h-5 w-5" /> Primary Currencies
                                <span className="text-sm font-normal text-muted-foreground ml-2">(Rates in Toman)</span>
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {MAJOR_FIAT.map(currency => renderRateCard(currency, 'TOMAN'))}
                            </div>
                        </section>

                        {/* Other Currencies (Mixed: Fiat in CAD, Crypto in USD) */}
                        <section>
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <ArrowRightLeft className="h-5 w-5" /> Other Currencies
                                <span className="text-sm font-normal text-muted-foreground ml-2">(Fiat in CAD, Crypto in USD)</span>
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {OTHER_FIAT_CAD_PEGGED.map(currency => renderRateCard(currency, 'CROSS_CAD'))}
                                {CRYPTO_USD_PEGGED.map(currency => renderRateCard(currency, 'CROSS_USD'))}
                            </div>
                        </section>

                        <section>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold flex items-center gap-2">
                                        <Clock className="h-5 w-5" /> All Navasan Items
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Full list from the API guide (live market values).
                                    </p>
                                </div>
                                <Input
                                    value={navasanFilter}
                                    onChange={(event) => setNavasanFilter(event.target.value)}
                                    placeholder="Search item or name..."
                                    className="h-9 md:w-72"
                                />
                            </div>
                            <Card>
                                <CardContent className="p-0">
                                    <div className="max-h-[420px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[180px]">Item</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="text-right">Value</TableHead>
                                                    <TableHead className="text-right">Change</TableHead>
                                                    <TableHead className="text-right">Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoadingNavasan ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                                                            Loading Navasan items...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : navasanItems.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                                                            No items found.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    navasanItems.map((item) => (
                                                        <TableRow key={item.item}>
                                                            <TableCell className="font-mono text-xs">{item.item}</TableCell>
                                                            <TableCell className="text-sm">{item.currency_fa || '—'}</TableCell>
                                                            <TableCell className="text-right font-mono text-xs">
                                                                {formatRawValue(item.value)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs">
                                                                {item.change}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                                {String(item.date ?? '—')}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </>
                )
            }
        </div >
    );
}
