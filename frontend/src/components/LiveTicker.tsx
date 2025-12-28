'use client';

import { useGetNavasanRates } from '@/src/lib/queries/exchange-rate.query';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function LiveTicker() {
    const { data, isLoading } = useGetNavasanRates();

    const RELEVANT_TICKER = ['USD', 'CAD', 'EUR', 'AED', 'GBP', 'USDT', 'BTC'];

    if (isLoading) {
        return (
            <div className="border-b border-border bg-muted/40 py-2">
                <div className="container mx-auto px-4 flex items-center justify-center text-sm font-medium">
                    Loading live market rates...
                </div>
            </div>
        );
    }

    // data.data is the array of NavasanRate
    const rates = data?.data?.filter(r => RELEVANT_TICKER.includes(r.currency));

    if (!rates || rates.length === 0) return null;

    // Helper to format number
    const format = (val: string) => {
        // Navasan values are decimal strings often with high precision, or integer strings.
        // We want commas.
        const num = parseFloat(val);
        return isNaN(num) ? val : num.toLocaleString();
    };

    return (
        <div className="w-full overflow-hidden border-b border-border bg-muted/30 py-3">
            <div className="flex animate-marquee hover:[animation-play-state:paused] w-max items-center">
                {/* Duplicate the list to ensure smooth looping */}
                {[...rates, ...rates, ...rates].map((rate, idx) => {
                    const changeVal = parseFloat(rate.change) || 0;
                    return (
                        <div key={`${rate.currency}-${idx}`} className="flex items-center gap-2 mx-8 text-sm select-none">
                            <span className="font-bold text-primary">{rate.currency}</span>
                            <span className="font-mono font-medium">{format(rate.value)}</span>
                            {/* Simple change indicator */}
                            <div className="flex items-center gap-1">
                                {changeVal > 0 ? (
                                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                                ) : changeVal < 0 ? (
                                    <ArrowDown className="h-3 w-3 text-rose-500" />
                                ) : (
                                    <Minus className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={cn(
                                    "text-xs font-medium",
                                    changeVal > 0 ? "text-emerald-500" : changeVal < 0 ? "text-rose-500" : "text-muted-foreground"
                                )}>
                                    {rate.change_percent}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
