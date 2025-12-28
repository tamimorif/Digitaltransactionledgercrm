'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { ArrowRight, Calculator, RefreshCw } from 'lucide-react';
import { useGetActiveCurrencies } from '@/src/lib/queries/cash-balance.query';
import { useGetRates } from '@/src/lib/queries/exchange-rate.query';
import { toast } from 'sonner';

interface QuickConvertWidgetProps {
    compact?: boolean;
}

export function QuickConvertWidget({ compact = false }: QuickConvertWidgetProps) {
    const [amount, setAmount] = useState<string>('');
    const [fromCurrency, setFromCurrency] = useState<string>('USD');
    const [toCurrency, setToCurrency] = useState<string>('EUR');
    const [result, setResult] = useState<number | null>(null);
    const [rateUsed, setRateUsed] = useState<number | null>(null);

    const { data: currencies } = useGetActiveCurrencies();
    // We'll fetch rates for the 'from' currency to get the conversion
    const { data: rates, isLoading } = useGetRates();

    const handleCalculate = () => {
        if (!amount) {
            toast.error('Please enter an amount');
            return;
        }

        if (!rates || rates.length === 0) {
            toast.error('Exchange rates not available. Please set up exchange rates first.');
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        // Find direct rate
        const rateObj = rates.find(r => r.baseCurrency === fromCurrency && r.targetCurrency === toCurrency);
        let rate = rateObj?.rate;

        // If direct rate not found, try inverse
        if (!rate) {
            const inverseRateObj = rates.find(r => r.baseCurrency === toCurrency && r.targetCurrency === fromCurrency);
            if (inverseRateObj && inverseRateObj.rate > 0) {
                rate = 1 / inverseRateObj.rate;
            }
        }

        // If still not found, and both are the same
        if (!rate && fromCurrency === toCurrency) {
            rate = 1;
        }

        if (rate) {
            setResult(numAmount * rate);
            setRateUsed(rate);
            toast.success(`Converted ${numAmount} ${fromCurrency} to ${toCurrency}`);
        } else {
            setResult(null);
            setRateUsed(null);
            toast.error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
        }
    };

    useEffect(() => {
        setResult(null);
        setRateUsed(null);
    }, [amount, fromCurrency, toCurrency]);

    const spacingClass = compact ? 'space-y-3' : 'space-y-4';
    const inputClass = compact ? 'h-9 text-sm' : '';
    const triggerClass = compact ? 'h-9 text-sm' : '';
    const buttonClass = compact ? 'h-9 text-sm bg-emerald-600 hover:bg-emerald-700' : '';

    return (
        <Card className="h-full">
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

                    <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                        <div className="space-y-2">
                            <Label>From</Label>
                            <Select value={fromCurrency} onValueChange={setFromCurrency}>
                                <SelectTrigger className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {currencies?.map((c: string) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    )) || <SelectItem value="USD">USD</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pb-2 text-muted-foreground">
                            <ArrowRight className="h-4 w-4" />
                        </div>

                        <div className="space-y-2">
                            <Label>To</Label>
                            <Select value={toCurrency} onValueChange={setToCurrency}>
                                <SelectTrigger className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {currencies?.map((c: string) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    )) || <SelectItem value="EUR">EUR</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button
                        className={`w-full ${buttonClass}`}
                        onClick={handleCalculate}
                        disabled={!amount || isLoading}
                    >
                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Convert'}
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
