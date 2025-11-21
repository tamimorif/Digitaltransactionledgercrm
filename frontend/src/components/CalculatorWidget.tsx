import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calculator, ArrowRight } from 'lucide-react';
import { handleNumberInput, parseFormattedNumber, formatCurrency } from '@/src/lib/format';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

interface CalculatorWidgetProps {
    onRateCalculated?: (from: string, to: string, rate: number) => void;
}

export function CalculatorWidget({ onRateCalculated }: CalculatorWidgetProps) {
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
        <Card className="sticky top-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Quick Calculator
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Amount Input */}
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={handleNumberInput(amount)}
                        onChange={(e) => setAmount(parseFormattedNumber(e.target.value))}
                        placeholder="1,000.00"
                    />
                </div>

                {/* From Currency */}
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">From Currency</label>
                    <Select value={fromCurrency} onValueChange={setFromCurrency}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map((curr) => (
                                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                    <button
                        onClick={swapCurrencies}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        title="Swap currencies"
                    >
                        <ArrowRight className="h-4 w-4 rotate-90" />
                    </button>
                </div>

                {/* To Currency */}
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">To Currency</label>
                    <Select value={toCurrency} onValueChange={setToCurrency}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map((curr) => (
                                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Exchange Rate */}
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Exchange Rate</label>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={handleNumberInput(rate)}
                        onChange={(e) => setRate(parseFormattedNumber(e.target.value))}
                        placeholder="1.0000"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        1 {fromCurrency} = {rate} {toCurrency}
                    </p>
                </div>

                {/* Result */}
                <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Result</p>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {calculateResult()} {toCurrency}
                        </p>
                    </div>
                </div>

                {/* Use Rate Button */}
                {onRateCalculated && (
                    <button
                        onClick={() => onRateCalculated(fromCurrency, toCurrency, parseFloat(parseFormattedNumber(rate)))}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2"
                    >
                        Use this rate in transaction →
                    </button>
                )}
            </CardContent>
        </Card>
    );
}
