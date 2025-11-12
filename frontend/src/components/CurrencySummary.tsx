'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowRight, TrendingUp } from 'lucide-react';

interface Transaction {
    id: string;
    sendCurrency: string;
    sendAmount: number;
    receiveCurrency: string;
    receiveAmount: number;
    transactionDate: string;
}

interface CurrencySummaryProps {
    transactions: Transaction[];
    title?: string;
}

interface CurrencyPairSummary {
    pair: string;
    sendCurrency: string;
    receiveCurrency: string;
    count: number;
    totalSent: number;
    totalReceived: number;
}

export function CurrencySummary({ transactions, title = 'Currency Exchange Summary' }: CurrencySummaryProps) {
    const currencyPairSummary = useMemo(() => {
        const summaryMap = new Map<string, CurrencyPairSummary>();

        transactions.forEach((tx) => {
            const pairKey = `${tx.sendCurrency}-${tx.receiveCurrency}`;

            if (!summaryMap.has(pairKey)) {
                summaryMap.set(pairKey, {
                    pair: pairKey,
                    sendCurrency: tx.sendCurrency,
                    receiveCurrency: tx.receiveCurrency,
                    count: 0,
                    totalSent: 0,
                    totalReceived: 0,
                });
            }

            const summary = summaryMap.get(pairKey)!;
            summary.count += 1;
            summary.totalSent += tx.sendAmount;
            summary.totalReceived += tx.receiveAmount;
        });

        return Array.from(summaryMap.values()).sort((a, b) => b.count - a.count);
    }, [transactions]);

    const totalTransactions = transactions.length;

    if (transactions.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {title}
                </CardTitle>
                <CardDescription>
                    Transaction breakdown by currency pairs ({totalTransactions} total)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {currencyPairSummary.map((summary) => (
                        <div
                            key={summary.pair}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 font-medium">
                                    <span className="text-lg">{summary.sendCurrency}</span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-lg">{summary.receiveCurrency}</span>
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                    {summary.count} {summary.count === 1 ? 'transaction' : 'transactions'}
                                </Badge>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Volume</p>
                                <p className="font-medium">
                                    {summary.totalSent.toLocaleString()} {summary.sendCurrency}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    ≈ {summary.totalReceived.toLocaleString()} {summary.receiveCurrency}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <p className="text-sm text-muted-foreground">Unique Pairs</p>
                        <p className="text-2xl font-bold">{currencyPairSummary.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                        <p className="text-sm text-muted-foreground">Most Popular</p>
                        <p className="text-xl font-bold">
                            {currencyPairSummary[0]?.sendCurrency} → {currencyPairSummary[0]?.receiveCurrency}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
