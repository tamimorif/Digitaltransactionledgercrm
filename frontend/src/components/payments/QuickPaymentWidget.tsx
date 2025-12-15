'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    Zap,
    DollarSign,
    Percent,
    Clock,
    Repeat
} from 'lucide-react';

interface QuickPaymentWidgetProps {
    remainingBalance: number;
    baseCurrency: string;
    onQuickPay: (amount: number, description: string) => void;
    lastPaymentAmount?: number;
    lastPaymentMethod?: string;
    isLoading?: boolean;
}

// Common preset amounts for quick selection
const PRESET_AMOUNTS = [
    { value: 500, label: '$500' },
    { value: 1000, label: '$1,000' },
    { value: 2000, label: '$2,000' },
    { value: 5000, label: '$5,000' },
];

// Percentage quick buttons
const PERCENTAGE_OPTIONS = [
    { value: 0.25, label: '25%' },
    { value: 0.50, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.00, label: '100%' },
];

export function QuickPaymentWidget({
    remainingBalance,
    baseCurrency,
    onQuickPay,
    lastPaymentAmount,
    lastPaymentMethod,
    isLoading = false,
}: QuickPaymentWidgetProps) {
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

    const handlePercentageClick = (percentage: number) => {
        const amount = Math.round(remainingBalance * percentage * 100) / 100;
        setSelectedAmount(amount);
        onQuickPay(amount, `${percentage * 100}% of remaining`);
    };

    const handlePresetClick = (amount: number) => {
        // Don't allow paying more than remaining
        const payAmount = Math.min(amount, remainingBalance);
        setSelectedAmount(payAmount);
        onQuickPay(payAmount, `Quick pay ${amount.toLocaleString()}`);
    };

    const handleRepeatLast = () => {
        if (lastPaymentAmount && lastPaymentAmount <= remainingBalance) {
            setSelectedAmount(lastPaymentAmount);
            onQuickPay(lastPaymentAmount, 'Repeat last payment');
        }
    };

    return (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5 text-primary" />
                    Quick Payment
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {remainingBalance.toLocaleString()} {baseCurrency} remaining
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Percentage Buttons */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Percent className="h-4 w-4" />
                        <span>Pay by percentage</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {PERCENTAGE_OPTIONS.map((option) => {
                            const amount = Math.round(remainingBalance * option.value * 100) / 100;
                            return (
                                <Button
                                    key={option.label}
                                    variant={selectedAmount === amount ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handlePercentageClick(option.value)}
                                    disabled={isLoading || remainingBalance <= 0}
                                    className="flex-col h-auto py-2"
                                >
                                    <span className="font-bold">{option.label}</span>
                                    <span className="text-xs opacity-70">
                                        {amount.toLocaleString()}
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* Preset Amounts */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>Common amounts</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_AMOUNTS.map((preset) => {
                            const isDisabled = preset.value > remainingBalance;
                            const displayAmount = isDisabled ? remainingBalance : preset.value;
                            return (
                                <Button
                                    key={preset.value}
                                    variant={selectedAmount === displayAmount ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handlePresetClick(preset.value)}
                                    disabled={isLoading || remainingBalance <= 0 || isDisabled}
                                    className={isDisabled ? 'opacity-50' : ''}
                                >
                                    {preset.label}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* Repeat Last Payment */}
                {lastPaymentAmount && lastPaymentAmount <= remainingBalance && (
                    <div className="pt-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRepeatLast}
                            disabled={isLoading}
                            className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                            <Repeat className="h-4 w-4" />
                            <span>Repeat last payment</span>
                            <Badge variant="outline" className="ml-auto">
                                {lastPaymentAmount.toLocaleString()} {baseCurrency}
                                {lastPaymentMethod && ` • ${lastPaymentMethod}`}
                            </Badge>
                        </Button>
                    </div>
                )}

                {/* Quick Tip */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                    <Clock className="h-3 w-3" />
                    <span>Click any button to instantly fill the payment form</span>
                </div>
            </CardContent>
        </Card>
    );
}
