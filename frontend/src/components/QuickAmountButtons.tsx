'use client';

import { Button } from '@/src/components/ui/button';
import { useTranslation } from 'react-i18next';

interface QuickAmountButtonsProps {
    currency: string;
    onAmountSelect: (amount: string) => void;
}

export function QuickAmountButtons({ currency, onAmountSelect }: QuickAmountButtonsProps) {
    const { t } = useTranslation();

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
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
                {t('transaction.quickAmounts.title')}
            </p>
            <div className="flex flex-wrap gap-2">
                {amounts.map(amount => (
                    <Button
                        key={amount}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAmountSelect(amount.toString())}
                        className="text-xs"
                    >
                        {amount.toLocaleString()} {currency}
                    </Button>
                ))}
            </div>
        </div>
    );
}
