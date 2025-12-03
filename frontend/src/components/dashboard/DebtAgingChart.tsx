'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Progress } from '@/src/components/ui/progress';
import { useGetDebtAging } from '@/src/lib/queries/dashboard.query';
import { formatNumber, formatCurrency } from '@/src/lib/format';
import { cn } from '@/src/lib/utils';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

interface DebtAgingChartProps {
    branchId?: number;
}

export function DebtAgingChart({ branchId }: DebtAgingChartProps) {
    const { data: debtAging, isLoading, error } = useGetDebtAging(branchId);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Debt Aging</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-full" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !debtAging) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Debt Aging</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">
                        Failed to load debt aging data
                    </p>
                </CardContent>
            </Card>
        );
    }

    const totalCount = debtAging.reduce((sum, bucket) => sum + bucket.count, 0);
    const totalCAD = debtAging.reduce((sum, bucket) => sum + bucket.totalCad, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Debt Aging Report
                </CardTitle>
                <CardDescription>
                    Outstanding remittances by age ({totalCount} total)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {debtAging.map((bucket) => {
                        const percentage = totalCount > 0 ? (bucket.count / totalCount) * 100 : 0;

                        return (
                            <div key={bucket.bucket} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{bucket.bucket}</span>
                                        {bucket.isCritical && (
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        {bucket.isWarning && !bucket.isCritical && (
                                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={
                                                bucket.isCritical
                                                    ? 'destructive'
                                                    : bucket.isWarning
                                                        ? 'secondary'
                                                        : 'outline'
                                            }
                                        >
                                            {bucket.count}
                                        </Badge>
                                    </div>
                                </div>
                                <Progress
                                    value={percentage}
                                    className={cn(
                                        "h-2",
                                        bucket.isCritical && "[&>div]:bg-red-500",
                                        bucket.isWarning && !bucket.isCritical && "[&>div]:bg-yellow-500"
                                    )}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{formatNumber(bucket.totalIrr)} IRR</span>
                                    <span>{formatCurrency(bucket.totalCad, 'CAD')}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {totalCount > 0 && (
                    <div className="mt-6 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Total Outstanding</span>
                            <span className="text-lg font-bold">
                                {formatCurrency(totalCAD, 'CAD')}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
