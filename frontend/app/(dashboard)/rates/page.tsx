'use client';

import { useState } from 'react';
import {
    useGetRates,
    useRefreshRates,
    useSetCustomRate,
    useGetScrapedRates,
    useRefreshScrapedRates,
    type ExchangeRate,
    type ScrapedRate,
} from '@/src/lib/queries/exchange-rate.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
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
const RELEVANT_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'IRR'];

const CURRENCY_INFO: Record<string, { name: string; symbol: string; flag: string }> = {
    CAD: { name: 'Canadian Dollar', symbol: '$', flag: '🇨🇦' },
    USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
    GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    IRR: { name: 'Iranian Rial (Toman)', symbol: '﷼', flag: '🇮🇷' },
};

// Format number with commas
const formatWithCommas = (num: number, decimals: number = 0): string => {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

// Spread percentage for buy/sell rates (adjustable per currency pair)
const SPREAD_CONFIG: Record<string, { buySpread: number; sellSpread: number }> = {
    'CAD-IRR': { buySpread: 0.02, sellSpread: -0.02 }, // 2% spread
    'USD-IRR': { buySpread: 0.02, sellSpread: -0.02 },
    'EUR-IRR': { buySpread: 0.025, sellSpread: -0.025 },
    'GBP-IRR': { buySpread: 0.025, sellSpread: -0.025 },
    'default': { buySpread: 0.015, sellSpread: -0.015 },
};

const getBuySellRates = (baseRate: number, baseCurrency: string, targetCurrency: string) => {
    const key = `${baseCurrency}-${targetCurrency}`;
    const config = SPREAD_CONFIG[key] || SPREAD_CONFIG['default'];

    // Buy rate: what customer pays to buy target currency (higher)
    // Sell rate: what customer gets when selling target currency (lower)
    const buyRate = baseRate * (1 + config.buySpread);
    const sellRate = baseRate * (1 + config.sellSpread);

    return { buyRate, sellRate };
};

export default function RatesPage() {
    const [openCustom, setOpenCustom] = useState(false);
    const [baseCurrency, setBaseCurrency] = useState('CAD');
    const [targetCurrency, setTargetCurrency] = useState('IRR');
    const [customBuyRate, setCustomBuyRate] = useState('');
    const [customSellRate, setCustomSellRate] = useState('');
    const [rateType, setRateType] = useState<'buy' | 'sell'>('buy');

    const { data: rates, isLoading } = useGetRates();
    const { data: scrapedRatesData, isLoading: isLoadingScraped, error: scrapedError } = useGetScrapedRates();
    const refreshRates = useRefreshRates();
    const refreshScrapedRates = useRefreshScrapedRates();
    const setCustomRateMutation = useSetCustomRate();

    // Get scraped rates as a map for easy lookup
    const scrapedRatesMap: Record<string, ScrapedRate> = {};
    scrapedRatesData?.rates?.forEach((rate) => {
        scrapedRatesMap[rate.currency] = rate;
    });

    const handleRefreshRates = () => {
        refreshScrapedRates.mutate(undefined, {
            onSuccess: () => {
                toast.success('Live rates refreshed from sarafibahmani.ca');
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

        if (buyRate <= sellRate) {
            toast.error('Buy rate should be higher than sell rate');
            return;
        }

        // Store the mid-rate (average of buy and sell)
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

    // Filter rates to only show relevant currencies
    const filteredRates = rates?.filter(
        (rate) =>
            RELEVANT_CURRENCIES.includes(rate.baseCurrency) &&
            RELEVANT_CURRENCIES.includes(rate.targetCurrency)
    );

    // Get CAD rate from scraped data (live from sarafibahmani.ca)
    const cadScraped = scrapedRatesMap['CAD'];
    const usdScraped = scrapedRatesMap['USD'];
    const eurScraped = scrapedRatesMap['EUR'];
    const gbpScraped = scrapedRatesMap['GBP'];

    // Get CAD to IRR rate (most important for Hawala)
    const cadToIrr = filteredRates?.find(
        (r) => r.baseCurrency === 'CAD' && r.targetCurrency === 'IRR'
    );

    // Use scraped rates if available, otherwise fall back to calculated rates
    const cadToIrrRates = cadScraped ? {
        buyRate: parseFloat(cadScraped.buy_rate),
        sellRate: parseFloat(cadScraped.sell_rate),
    } : cadToIrr ? getBuySellRates(cadToIrr.rate, 'CAD', 'IRR') : null;

    // Get rates grouped by base currency
    const ratesByBase = filteredRates?.reduce((acc: Record<string, ExchangeRate[]>, rate) => {
        if (!acc[rate.baseCurrency]) {
            acc[rate.baseCurrency] = [];
        }
        acc[rate.baseCurrency].push(rate);
        return acc;
    }, {});

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Exchange Rates</h1>
                    <p className="text-muted-foreground mt-1">
                        Live rates from{' '}
                        <a href="https://sarafibahmani.ca" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            sarafibahmani.ca
                        </a>
                    </p>
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
                    <Dialog open={openCustom} onOpenChange={setOpenCustom}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Set Custom Rate
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Set Custom Exchange Rate</DialogTitle>
                                <DialogDescription>Set your buy and sell rates for this currency pair</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>From Currency</Label>
                                        <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RELEVANT_CURRENCIES.map((currency) => (
                                                    <SelectItem key={currency} value={currency}>
                                                        {CURRENCY_INFO[currency]?.flag} {currency}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>To Currency</Label>
                                        <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RELEVANT_CURRENCIES.map((currency) => (
                                                    <SelectItem key={currency} value={currency}>
                                                        {CURRENCY_INFO[currency]?.flag} {currency}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <ArrowUp className="h-4 w-4 text-green-600" />
                                        Buy Rate (Customer buys {targetCurrency})
                                    </Label>
                                    <Input
                                        type="text"
                                        value={customBuyRate}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^\d.]/g, '');
                                            setCustomBuyRate(value);
                                        }}
                                        placeholder={targetCurrency === 'IRR' ? '86,000' : '1.40'}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Higher rate - you profit when customer buys
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <ArrowDown className="h-4 w-4 text-red-600" />
                                        Sell Rate (Customer sells {targetCurrency})
                                    </Label>
                                    <Input
                                        type="text"
                                        value={customSellRate}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^\d.]/g, '');
                                            setCustomSellRate(value);
                                        }}
                                        placeholder={targetCurrency === 'IRR' ? '84,000' : '1.38'}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Lower rate - you profit when customer sells
                                    </p>
                                </div>

                                {customBuyRate && customSellRate && (
                                    <div className="p-3 bg-muted rounded-lg">
                                        <p className="text-sm font-medium mb-1">Spread Preview</p>
                                        <p className="text-xs text-muted-foreground">
                                            Spread: {formatWithCommas(parseFloat(customBuyRate.replace(/,/g, '')) - parseFloat(customSellRate.replace(/,/g, '')), targetCurrency === 'IRR' ? 0 : 4)} {targetCurrency}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpenCustom(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSetCustomRate} disabled={setCustomRateMutation.isPending}>
                                    {setCustomRateMutation.isPending && (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    )}
                                    Set Rates
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {isLoading || isLoadingScraped ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {/* Live Rate Source Banner */}
                    {scrapedRatesData && (
                        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                            <CardContent className="py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                        Live rates from sarafibahmani.ca
                                    </span>
                                </div>
                                {cadScraped?.scraped_at && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        Last updated: {new Date(cadScraped.scraped_at).toLocaleTimeString()}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

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

                    {/* Main Rate Card - CAD to IRR */}
                    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-3xl">🇨🇦</span>
                                    <span>CAD</span>
                                </div>
                                <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
                                <div className="flex items-center gap-2">
                                    <span className="text-3xl">🇮🇷</span>
                                    <span>IRR (Toman)</span>
                                </div>
                                {cadScraped && (
                                    <Badge variant="outline" className="ml-auto bg-green-100 text-green-700 border-green-300">
                                        <Globe className="h-3 w-3 mr-1" />
                                        Live
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {cadScraped ? 'Live rate from sarafibahmani.ca - دلار کانادا (نقدی)' : 'Primary exchange rate for remittances'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Buy Rate */}
                                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowUp className="h-5 w-5 text-green-600" />
                                        <span className="font-medium text-green-700 dark:text-green-400">Buy Rate</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1">Customer buys IRR (sends to Iran)</p>
                                    <p className="text-3xl font-bold font-mono text-green-700 dark:text-green-400">
                                        {cadToIrrRates ? formatWithCommas(cadToIrrRates.buyRate) : '—'}
                                        <span className="text-base text-muted-foreground ml-2">IRR</span>
                                    </p>
                                    {cadToIrrRates && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            ≈ {formatWithCommas(cadToIrrRates.buyRate / 10)} Toman
                                        </p>
                                    )}
                                </div>

                                {/* Sell Rate */}
                                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowDown className="h-5 w-5 text-red-600" />
                                        <span className="font-medium text-red-700 dark:text-red-400">Sell Rate</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1">Customer sells IRR (receives from Iran)</p>
                                    <p className="text-3xl font-bold font-mono text-red-700 dark:text-red-400">
                                        {cadToIrrRates ? formatWithCommas(cadToIrrRates.sellRate) : '—'}
                                        <span className="text-base text-muted-foreground ml-2">IRR</span>
                                    </p>
                                    {cadToIrrRates && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            ≈ {formatWithCommas(cadToIrrRates.sellRate / 10)} Toman
                                        </p>
                                    )}
                                </div>
                            </div>

                            {(cadToIrr || cadScraped) && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={cadScraped ? 'default' : cadToIrr?.source === 'API' ? 'default' : 'secondary'}
                                            className={cn(
                                                cadScraped && 'bg-green-600 hover:bg-green-700',
                                                !cadScraped && cadToIrr?.source === 'MANUAL' && 'bg-amber-100 text-amber-700'
                                            )}
                                        >
                                            {cadScraped ? 'LIVE' : cadToIrr?.source}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            Spread: {cadToIrrRates ? formatWithCommas(cadToIrrRates.buyRate - cadToIrrRates.sellRate) : '—'} Toman
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {cadScraped
                                            ? `Updated: ${new Date(cadScraped.scraped_at).toLocaleString()}`
                                            : cadToIrr && `Updated: ${new Date(cadToIrr.updatedAt).toLocaleString()}`
                                        }
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Other Currency Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {RELEVANT_CURRENCIES.filter(c => c !== 'IRR').map((currency) => {
                            const currencyRates = ratesByBase?.[currency] || [];
                            const toIrr = currencyRates.find((r) => r.targetCurrency === 'IRR');
                            const toCad = currencyRates.find((r) => r.targetCurrency === 'CAD');
                            const info = CURRENCY_INFO[currency];
                            const scrapedRate = scrapedRatesMap[currency];

                            // Use scraped rates if available
                            const irrRates = scrapedRate ? {
                                buyRate: parseFloat(scrapedRate.buy_rate),
                                sellRate: parseFloat(scrapedRate.sell_rate),
                            } : toIrr ? getBuySellRates(toIrr.rate, currency, 'IRR') : null;

                            const isLive = !!scrapedRate;
                            const isAvailable = scrapedRate?.is_available !== false;

                            return (
                                <Card key={currency} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <span className="text-2xl">{info.flag}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{currency}</span>
                                                    {isLive && (
                                                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                                                            Live
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs font-normal text-muted-foreground">
                                                    {scrapedRate?.currency_fa || info.name}
                                                </p>
                                            </div>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {!isAvailable ? (
                                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded text-center">
                                                <span className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                                                    Temporarily Unavailable
                                                </span>
                                            </div>
                                        ) : irrRates ? (
                                            <>
                                                <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                                    <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                                                        <ArrowUp className="h-3 w-3" /> Buy
                                                    </span>
                                                    <span className="font-mono font-medium text-sm">
                                                        {scrapedRate?.buy_rate_formatted || formatWithCommas(irrRates.buyRate)} T
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/30 rounded">
                                                    <span className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                                                        <ArrowDown className="h-3 w-3" /> Sell
                                                    </span>
                                                    <span className="font-mono font-medium text-sm">
                                                        {scrapedRate?.sell_rate_formatted || formatWithCommas(irrRates.sellRate)} T
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-3 bg-muted/50 rounded text-center">
                                                <span className="text-muted-foreground text-sm">No rate available</span>
                                            </div>
                                        )}
                                        {/* To CAD (if not CAD) - for cross rates */}
                                        {currency !== 'CAD' && toCad && (
                                            <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                                <span className="text-xs text-muted-foreground">→ CAD</span>
                                                <span className="font-mono font-medium text-sm">
                                                    {toCad.rate.toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Quick Reference Table - Scraped Rates */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Live Rates from sarafibahmani.ca
                            </CardTitle>
                            <CardDescription>Current buy & sell rates in Toman</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-3 font-medium">Currency</th>
                                            <th className="text-left py-3 px-3 font-medium">Name (FA)</th>
                                            <th className="text-right py-3 px-3 font-medium text-green-600">
                                                <span className="flex items-center justify-end gap-1">
                                                    <ArrowUp className="h-3 w-3" /> Buy Rate
                                                </span>
                                            </th>
                                            <th className="text-right py-3 px-3 font-medium text-red-600">
                                                <span className="flex items-center justify-end gap-1">
                                                    <ArrowDown className="h-3 w-3" /> Sell Rate
                                                </span>
                                            </th>
                                            <th className="text-right py-3 px-3 font-medium">Spread</th>
                                            <th className="text-center py-3 px-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scrapedRatesData?.rates?.map((rate) => {
                                            const buyRate = parseFloat(rate.buy_rate);
                                            const sellRate = parseFloat(rate.sell_rate);
                                            const spread = sellRate - buyRate;
                                            const info = CURRENCY_INFO[rate.currency];

                                            return (
                                                <tr key={rate.currency} className="border-b hover:bg-muted/50">
                                                    <td className="py-3 px-3">
                                                        <span className="mr-1">{info?.flag}</span>
                                                        {rate.currency}
                                                    </td>
                                                    <td className="py-3 px-3 text-muted-foreground">
                                                        {rate.currency_fa}
                                                    </td>
                                                    <td className="text-right py-3 px-3 font-mono font-medium text-green-600">
                                                        {rate.is_available ? rate.buy_rate_formatted : 'N/A'}
                                                    </td>
                                                    <td className="text-right py-3 px-3 font-mono font-medium text-red-600">
                                                        {rate.is_available ? rate.sell_rate_formatted : 'N/A'}
                                                    </td>
                                                    <td className="text-right py-3 px-3 font-mono text-xs text-muted-foreground">
                                                        {rate.is_available ? formatWithCommas(spread) : '—'}
                                                    </td>
                                                    <td className="text-center py-3 px-3">
                                                        <Badge
                                                            variant={rate.is_available ? 'default' : 'outline'}
                                                            className={cn(
                                                                "text-xs",
                                                                rate.is_available
                                                                    ? 'bg-green-100 text-green-700 border-green-300'
                                                                    : 'bg-amber-100 text-amber-700 border-amber-300'
                                                            )}
                                                        >
                                                            {rate.is_available ? 'Active' : 'Unavailable'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!scrapedRatesData?.rates || scrapedRatesData.rates.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No live rates available. Click "Refresh Live Rates" to fetch.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}