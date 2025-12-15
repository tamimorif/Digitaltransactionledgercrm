'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
    Lock,
    Unlock,
    RefreshCw,
    Clock,
    TrendingUp,
    TrendingDown,
    AlertTriangle
} from 'lucide-react';

interface RateLockWidgetProps {
    currentRate: number;
    baseCurrency: string;
    targetCurrency: string;
    lockDurationMinutes?: number;
    rateChangeThreshold?: number; // Percentage threshold for alerts
    onRateLocked?: (rate: number, expiresAt: Date) => void;
    onRateUnlocked?: () => void;
    onRefreshRate?: () => Promise<number>;
}

export function RateLockWidget({
    currentRate,
    baseCurrency,
    targetCurrency,
    lockDurationMinutes = 15,
    rateChangeThreshold = 0.5, // 0.5% threshold
    onRateLocked,
    onRateUnlocked,
    onRefreshRate,
}: RateLockWidgetProps) {
    const [isLocked, setIsLocked] = useState(false);
    const [lockedRate, setLockedRate] = useState<number | null>(null);
    const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [rateAtLock, setRateAtLock] = useState<number | null>(null);

    // Calculate rate change percentage
    const rateChangePercent = lockedRate && currentRate
        ? ((currentRate - lockedRate) / lockedRate) * 100
        : 0;

    const hasSignificantChange = Math.abs(rateChangePercent) >= rateChangeThreshold;
    const rateIncreased = rateChangePercent > 0;

    // Timer effect
    useEffect(() => {
        if (!isLocked || !lockExpiresAt) return;

        const interval = setInterval(() => {
            const now = new Date();
            const remaining = Math.max(0, lockExpiresAt.getTime() - now.getTime());
            setTimeRemaining(remaining);

            if (remaining <= 0) {
                handleUnlock();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isLocked, lockExpiresAt]);

    const handleLock = useCallback(() => {
        const expiresAt = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
        setIsLocked(true);
        setLockedRate(currentRate);
        setRateAtLock(currentRate);
        setLockExpiresAt(expiresAt);
        setTimeRemaining(lockDurationMinutes * 60 * 1000);

        onRateLocked?.(currentRate, expiresAt);
    }, [currentRate, lockDurationMinutes, onRateLocked]);

    const handleUnlock = useCallback(() => {
        setIsLocked(false);
        setLockedRate(null);
        setLockExpiresAt(null);
        setTimeRemaining(0);
        setRateAtLock(null);

        onRateUnlocked?.();
    }, [onRateUnlocked]);

    const handleRefresh = async () => {
        if (!onRefreshRate) return;

        setIsRefreshing(true);
        try {
            await onRefreshRate();
        } finally {
            setIsRefreshing(false);
        }
    };

    const formatTimeRemaining = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const displayRate = isLocked && lockedRate ? lockedRate : currentRate;

    return (
        <Card className={`transition-all ${isLocked
                ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30'
                : 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20'
            }`}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                    {/* Rate Display */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            {isLocked ? (
                                <>
                                    <Lock className="h-4 w-4 text-green-600" />
                                    <span className="text-green-600 font-medium">Rate Locked</span>
                                </>
                            ) : (
                                <>
                                    <Unlock className="h-4 w-4" />
                                    <span>Current Rate</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">
                                {displayRate.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6
                                })}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                {baseCurrency}/{targetCurrency}
                            </span>
                        </div>

                        {/* Rate Change Alert */}
                        {isLocked && hasSignificantChange && (
                            <div className={`flex items-center gap-2 mt-2 text-sm ${rateIncreased ? 'text-green-600' : 'text-red-600'
                                }`}>
                                <AlertTriangle className="h-4 w-4" />
                                {rateIncreased ? (
                                    <TrendingUp className="h-4 w-4" />
                                ) : (
                                    <TrendingDown className="h-4 w-4" />
                                )}
                                <span>
                                    Rate {rateIncreased ? 'increased' : 'decreased'} by{' '}
                                    {Math.abs(rateChangePercent).toFixed(2)}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Timer & Actions */}
                    <div className="flex flex-col items-end gap-2">
                        {isLocked ? (
                            <>
                                <Badge
                                    variant="outline"
                                    className="border-green-500 text-green-600 flex items-center gap-1"
                                >
                                    <Clock className="h-3 w-3" />
                                    {formatTimeRemaining(timeRemaining)}
                                </Badge>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleUnlock}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                    <Unlock className="h-4 w-4 mr-1" />
                                    Unlock
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleLock}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Lock className="h-4 w-4 mr-1" />
                                    Lock Rate
                                </Button>
                                {onRefreshRate && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                    >
                                        <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Lock Duration Info */}
                {!isLocked && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        Lock rate for {lockDurationMinutes} minutes to protect against rate fluctuations
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
