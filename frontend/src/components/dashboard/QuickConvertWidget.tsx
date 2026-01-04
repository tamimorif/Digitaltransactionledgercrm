'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Calculator, RefreshCw } from 'lucide-react';
import { useGetActiveCurrencies } from '@/src/lib/queries/cash-balance.query';
import { useGetRates, useRefreshRates, type ExchangeRate } from '@/src/lib/queries/exchange-rate.query';
import { CURRENCIES, CURRENCY_NAMES } from '@/src/lib/constants';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface QuickConvertWidgetProps {
    compact?: boolean;
    className?: string;
}

const DEFAULT_REFRESH_BASE = 'USD';
const CROSS_RATE_BASES = ['USD', 'CAD', 'EUR', 'GBP'];
const currencyNames = CURRENCY_NAMES as Record<string, string>;

const findDirectRate = (rates: ExchangeRate[], from: string, to: string) => {
    const direct = rates.find((rate) => rate.baseCurrency === from && rate.targetCurrency === to);
    if (direct?.rate && direct.rate > 0) {
        return direct.rate;
    }

    const inverse = rates.find((rate) => rate.baseCurrency === to && rate.targetCurrency === from);
    if (inverse?.rate && inverse.rate > 0) {
        return 1 / inverse.rate;
    }

    return null;
};

const resolveRate = (rates: ExchangeRate[], from: string, to: string) => {
    if (from === to) {
        return 1;
    }

    const direct = findDirectRate(rates, from, to);
    if (direct) {
        return direct;
    }

    for (const pivot of CROSS_RATE_BASES) {
        if (pivot === from || pivot === to) {
            continue;
        }
        const fromToPivot = findDirectRate(rates, from, pivot);
        const pivotToTarget = findDirectRate(rates, pivot, to);
        if (fromToPivot && pivotToTarget) {
            return fromToPivot * pivotToTarget;
        }
    }

    return null;
};

const filterCurrencyOptions = (options: string[], query: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return options;
    }

    return options.filter((code) => {
        const name = currencyNames[code] ?? '';
        return code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);
    });
};

export function QuickConvertWidget({ compact = false, className }: QuickConvertWidgetProps) {
    const [amount, setAmount] = useState<string>('');
    const [fromCurrency, setFromCurrency] = useState<string>('USD');
    const [toCurrency, setToCurrency] = useState<string>('EUR');
    const [result, setResult] = useState<number | null>(null);
    const [rateUsed, setRateUsed] = useState<number | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [fromSearch, setFromSearch] = useState('');
    const [toSearch, setToSearch] = useState('');

    const { data: currencies } = useGetActiveCurrencies();
    // We'll fetch rates for the 'from' currency to get the conversion
    const { data: rates, isLoading, refetch } = useGetRates();
    const refreshRates = useRefreshRates();
    const currencyOptions = useMemo(() => {
        const options: string[] = [];
        const seen = new Set<string>();

        const addCurrency = (value?: string) => {
            if (!value) {
                return;
            }
            const normalized = value.toUpperCase();
            if (!seen.has(normalized)) {
                seen.add(normalized);
                options.push(normalized);
            }
        };

        currencies?.forEach(addCurrency);
        rates?.forEach((rate) => {
            addCurrency(rate.baseCurrency);
            addCurrency(rate.targetCurrency);
        });
        CURRENCIES.forEach(addCurrency);

        return options.length > 0 ? options : ['USD', 'EUR'];
    }, [currencies, rates]);
    const filteredFromOptions = useMemo(
        () => filterCurrencyOptions(currencyOptions, fromSearch),
        [currencyOptions, fromSearch]
    );
    const filteredToOptions = useMemo(
        () => filterCurrencyOptions(currencyOptions, toSearch),
        [currencyOptions, toSearch]
    );

    const refreshRatesIfNeeded = async () => {
        if (rates && rates.length > 0) {
            return rates;
        }

        try {
            await refreshRates.mutateAsync(DEFAULT_REFRESH_BASE);
            const refreshed = await refetch();
            return refreshed.data ?? [];
        } catch {
            return [];
        }
    };

    const handleCalculate = async () => {
        if (!amount) {
            toast.error('Please enter an amount');
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (fromCurrency === toCurrency) {
            setResult(numAmount);
            setRateUsed(1);
            toast.success(`Converted ${numAmount} ${fromCurrency} to ${toCurrency}`);
            return;
        }

        setIsCalculating(true);

        try {
            let availableRates = rates ?? [];

            if (availableRates.length === 0) {
                toast.info('Fetching latest exchange rates...');
                availableRates = await refreshRatesIfNeeded();
            }

            if (availableRates.length === 0) {
                setResult(null);
                setRateUsed(null);
                toast.error('Unable to load exchange rates. Please refresh in Treasury > FX Rates.');
                return;
            }

            const resolvedRate = resolveRate(availableRates, fromCurrency, toCurrency);

            if (resolvedRate) {
                setResult(numAmount * resolvedRate);
                setRateUsed(resolvedRate);
                toast.success(`Converted ${numAmount} ${fromCurrency} to ${toCurrency}`);
            } else {
                setResult(null);
                setRateUsed(null);
                toast.error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
            }
        } finally {
            setIsCalculating(false);
        }
    };

    useEffect(() => {
        setResult(null);
        setRateUsed(null);
    }, [amount, fromCurrency, toCurrency]);

    useEffect(() => {
        if (currencyOptions.length === 0) {
            return;
        }
        if (!currencyOptions.includes(fromCurrency)) {
            setFromCurrency(currencyOptions[0]);
        }
        if (!currencyOptions.includes(toCurrency)) {
            setToCurrency(currencyOptions[1] ?? currencyOptions[0]);
        }
    }, [currencyOptions, fromCurrency, toCurrency]);

    const spacingClass = compact ? 'space-y-3' : 'space-y-4';
    const inputClass = compact ? 'h-9 text-sm' : '';
    const triggerClass = compact ? 'h-9 text-sm' : '';
    const buttonClass = compact ? 'h-9 text-sm bg-emerald-600 hover:bg-emerald-700' : '';
    const isBusy = isLoading || refreshRates.isPending || isCalculating;
    const dropdownClassName = 'min-w-[240px] overflow-hidden p-0';
    const viewportClassName = 'h-auto max-h-[300px] overflow-y-auto p-2';
    const itemClassName = 'rounded-md px-3 py-2 text-sm';

    const renderSearchHeader = (value: string, onChange: (next: string) => void) => (
        <div className="sticky top-0 z-10 bg-popover p-2 border-b">
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search currency..."
                className="h-8 text-xs bg-muted/60"
                aria-label="Search currency"
                autoFocus
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            />
        </div>
    );

    return (
        <Card className={cn('gap-4', className)}>
            <CardHeader className={compact ? 'pb-1' : 'pb-2'}>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Quick Convert
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className={spacingClass}>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>From</Label>
                            <Select
                                value={fromCurrency}
                                onValueChange={setFromCurrency}
                                onOpenChange={() => setFromSearch('')}
                            >
                                <SelectTrigger className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                    className={dropdownClassName}
                                    header={renderSearchHeader(fromSearch, setFromSearch)}
                                    viewportClassName={viewportClassName}
                                >
                                    {filteredFromOptions.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">
                                            No matches
                                        </div>
                                    ) : (
                                        filteredFromOptions.map((c) => (
                                            <SelectItem key={c} value={c} className={itemClassName}>
                                                {c}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>To</Label>
                            <Select
                                value={toCurrency}
                                onValueChange={setToCurrency}
                                onOpenChange={() => setToSearch('')}
                            >
                                <SelectTrigger className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                    className={dropdownClassName}
                                    header={renderSearchHeader(toSearch, setToSearch)}
                                    viewportClassName={viewportClassName}
                                >
                                    {filteredToOptions.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">
                                            No matches
                                        </div>
                                    ) : (
                                        filteredToOptions.map((c) => (
                                            <SelectItem key={c} value={c} className={itemClassName}>
                                                {c}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button
                        className={`w-full ${buttonClass}`}
                        onClick={handleCalculate}
                        disabled={!amount || isBusy}
                    >
                        {isBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Convert'}
                    </Button>

                    {result !== null && (
                        <div className={`rounded-md text-center ${compact ? 'p-2 bg-muted/60' : 'mt-4 p-3 bg-muted'}`}>
                            <div className="text-xs text-muted-foreground mb-1">
                                Rate: {rateUsed?.toFixed(4)}
                            </div>
                            <div className={compact ? 'text-lg font-bold' : 'text-xl font-bold'}>
                                {result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="text-sm font-normal ml-1">{toCurrency}</span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
