'use client';

import { Button } from '@/src/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { Clock, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRateHistory, formatTimeAgo } from '@/src/lib/transaction-helpers';

interface RateHistoryDropdownProps {
    fromCurrency: string;
    toCurrency: string;
    onRateSelect: (rate: string) => void;
}

export function RateHistoryDropdown({ fromCurrency, toCurrency, onRateSelect }: RateHistoryDropdownProps) {
    const { t } = useTranslation();

    if (!fromCurrency || !toCurrency) return null;

    const history = getRateHistory(fromCurrency, toCurrency);

    if (history.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" type="button" className="gap-2">
                    <Clock className="h-3 w-3" />
                    {t('transaction.buttons.useLastRate')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Recent Rates ({fromCurrency} → {toCurrency})
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {history.map((item, index) => (
                    <DropdownMenuItem
                        key={index}
                        onClick={() => onRateSelect(item.rate)}
                        className="flex justify-between"
                    >
                        <span className="font-medium">{parseFloat(item.rate).toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(item.timestamp)}
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
