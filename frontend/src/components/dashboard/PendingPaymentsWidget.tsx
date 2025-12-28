'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import {
    Clock,
    DollarSign,
    ArrowRight,
    CreditCard,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import Link from 'next/link';

interface PendingTransaction {
    id: string;
    transactionId: string;
    clientName: string;
    remainingBalance: number;
    totalAmount: number;
    currency: string;
    paymentStatus: string;
    createdAt: string;
    daysOld: number;
}

interface PendingPaymentsWidgetProps {
    transactions: PendingTransaction[];
    isLoading?: boolean;
    onPayNow?: (transactionId: string) => void;
}

// Get aging color based on days old
function getAgingColor(daysOld: number): { bg: string; text: string; border: string } {
    if (daysOld < 7) {
        return { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30' };
    } else if (daysOld < 14) {
        return { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/30' };
    } else if (daysOld < 30) {
        return { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/30' };
    } else {
        return { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30' };
    }
}

// Get aging label
function getAgingLabel(daysOld: number): string {
    if (daysOld === 0) return 'Today';
    if (daysOld === 1) return '1 day';
    if (daysOld < 7) return `${daysOld} days`;
    if (daysOld < 14) return '1-2 weeks';
    if (daysOld < 30) return '2-4 weeks';
    return `${Math.floor(daysOld / 30)}+ months`;
}

export function PendingPaymentsWidget({
    transactions,
    isLoading = false,
    onPayNow,
}: PendingPaymentsWidgetProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showAll, setShowAll] = useState(false);

    // Calculate totals
    const totalOutstanding = transactions.reduce((sum, t) => sum + t.remainingBalance, 0);
    const criticalCount = transactions.filter(t => t.daysOld >= 30).length;
    const warningCount = transactions.filter(t => t.daysOld >= 14 && t.daysOld < 30).length;

    // Show first 5 or all
    const displayTransactions = showAll ? transactions : transactions.slice(0, 5);

    if (transactions.length === 0 && !isLoading) {
        return (
            <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
                <CardContent className="py-6">
                    <div className="flex items-center gap-3 text-green-600">
                        <div className="p-2 bg-green-500/20 rounded-full">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-medium">All Caught Up!</p>
                        <p className="text-sm opacity-80">No pending actions at this time.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-primary/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Pending Actions
                        <Badge variant="secondary" className="ml-2">
                            {transactions.length}
                        </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {criticalCount > 0 && (
                            <Badge variant="destructive" className="animate-pulse">
                                {criticalCount} overdue
                            </Badge>
                        )}
                        {warningCount > 0 && (
                            <Badge variant="outline" className="border-orange-500 text-orange-600">
                                {warningCount} due soon
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
                {/* Summary Bar */}
                <div className="flex items-center justify-between text-sm mt-2 p-2 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total Outstanding:</span>
                    <span className="font-bold text-lg">
                        ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} CAD
                    </span>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0">
                    <ScrollArea className={showAll && transactions.length > 5 ? 'h-80' : ''}>
                        <div className="space-y-2">
                            {displayTransactions.map((transaction) => {
                                const agingColor = getAgingColor(transaction.daysOld);
                                const paidPercentage = ((transaction.totalAmount - transaction.remainingBalance) / transaction.totalAmount) * 100;

                                return (
                                    <div
                                        key={transaction.id}
                                        className={`p-3 rounded-lg border ${agingColor.border} ${agingColor.bg} transition-all hover:shadow-sm`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium truncate">
                                                        {transaction.clientName}
                                                    </p>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs ${agingColor.text} ${agingColor.border}`}
                                                    >
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {getAgingLabel(transaction.daysOld)}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-sm text-muted-foreground">
                                                        Remaining:
                                                    </span>
                                                    <span className={`font-semibold ${agingColor.text}`}>
                                                        {transaction.remainingBalance.toLocaleString()} {transaction.currency}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        of {transaction.totalAmount.toLocaleString()}
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${paidPercentage}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {onPayNow && (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={() => onPayNow(transaction.transactionId)}
                                                        className="whitespace-nowrap"
                                                    >
                                                        Pay Now
                                                    </Button>
                                                )}
                                                <Link href={`/transactions/${transaction.transactionId}`}>
                                                    <Button size="sm" variant="ghost">
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    {transactions.length > 5 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAll(!showAll)}
                            className="w-full mt-2"
                        >
                            {showAll ? 'Show Less' : `Show All (${transactions.length})`}
                        </Button>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
