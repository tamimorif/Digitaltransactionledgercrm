import { useState } from 'react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from './ui/utils';
import { handleNumberInput, parseFormattedNumber, formatCurrency } from '@/src/lib/format';
import { ArrowRight } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

interface CalculatorWidgetProps {
    onRateCalculated?: (from: string, to: string, rate: number) => void;
    className?: string;
}

export function CalculatorWidget({ onRateCalculated, className }: CalculatorWidgetProps) {
    const [amount, setAmount] = useState('1000');
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [toCurrency, setToCurrency] = useState('CAD');
    const [rate, setRate] = useState('1.35');

    const calculateResult = () => {
        const amt = parseFloat(parseFormattedNumber(amount));
        const r = parseFloat(parseFormattedNumber(rate));
        if (isNaN(amt) || isNaN(r)) return '0.00';
        return formatCurrency(amt * r);
    };

    const swapCurrencies = () => {
        const temp = fromCurrency;
        setFromCurrency(toCurrency);
        setToCurrency(temp);

        // Invert the rate
        const currentRate = parseFloat(parseFormattedNumber(rate));
        if (currentRate > 0) {
            setRate((1 / currentRate).toFixed(4));
        }
    };

    return (
        <div className={cn('space-y-2', className)}>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Amount
                    </label>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={handleNumberInput(amount)}
                        onChange={(e) => setAmount(parseFormattedNumber(e.target.value))}
                        placeholder="1,000.00"
                        className="h-8 text-xs"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rate
                    </label>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={handleNumberInput(rate)}
                        onChange={(e) => setRate(parseFormattedNumber(e.target.value))}
                        placeholder="1.0000"
                        className="h-8 text-xs"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        From
                    </label>
                    <Select value={fromCurrency} onValueChange={setFromCurrency}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map((curr) => (
                                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        To
                    </label>
                    <Select value={toCurrency} onValueChange={setToCurrency}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map((curr) => (
                                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-lg border bg-emerald-50/60 p-2 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Result</p>
                    <p className="text-[10px] text-emerald-700/80">
                        1 {fromCurrency} = {rate} {toCurrency}
                    </p>
                </div>
                <div className="text-base font-bold text-emerald-700">
                    {calculateResult()} {toCurrency}
                </div>
            </div>

            <div className="flex gap-2">
                {onRateCalculated && (
                    <button
                        type="button"
                        onClick={() => onRateCalculated(fromCurrency, toCurrency, parseFloat(parseFormattedNumber(rate)))}
                        className="flex-1 rounded-md border border-emerald-200 bg-emerald-50 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 uppercase tracking-wide"
                    >
                        Use Rate
                    </button>
                )}
                <button
                    type="button"
                    onClick={swapCurrencies}
                    className="h-full aspect-square rounded-md border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center min-w-[32px]"
                    title="Swap currencies"
                >
                    <ArrowRight className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}
