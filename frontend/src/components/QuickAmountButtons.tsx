'use client';

import { Button } from '@/src/components/ui/button';

interface QuickAmountButtonsProps {
    currency: string;
    onAmountSelect: (amount: string) => void;
}

export function QuickAmountButtons({ currency, onAmountSelect }: QuickAmountButtonsProps) {
    const presets: { [key: string]: number[] } = {
        CAD: [100, 200, 500, 1000, 2000],
        USD: [100, 200, 500, 1000, 2000],
        EUR: [100, 200, 500, 1000],
        GBP: [50, 100, 200, 500],
        IRR: [1000000, 5000000, 10000000, 50000000, 100000000],
        AED: [500, 1000, 2000, 5000],
        TRY: [1000, 2000, 5000, 10000],
    };

    const amounts = presets[currency] || [100, 200, 500, 1000];

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                ⚡ Quick:
            </span>
            <div className="flex gap-1.5">
                {amounts.map(amount => (
                    <Button
                        key={amount}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onAmountSelect(amount.toString())}
                        className="h-6 px-2 text-xs rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-0"
                    >
                        {amount.toLocaleString()}
                    </Button>
                ))}
            </div>
        </div>
    );
}
