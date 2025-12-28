'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/src/lib/api-client';
import { Loader2, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PrintReceiptButton } from '../receipts/ReceiptButtons';

interface RecentTransaction {
    id: number | string;
    type?: string;
    paymentMethod?: string;
    transactionDate?: string;
    createdAt?: string;
    client?: { name?: string };
    sendAmount: number;
    sendCurrency: string;
    receiveAmount: number;
    receiveCurrency: string;
}

interface RecentActivityFeedProps {
    transactions?: RecentTransaction[];
    isLoading?: boolean;
}

export function RecentActivityFeed({ transactions: providedTransactions, isLoading: providedLoading }: RecentActivityFeedProps) {
    const shouldFetch = providedTransactions === undefined;
    const { data: fetchedTransactions, isLoading } = useQuery<RecentTransaction[]>({
        queryKey: ['recent-transactions'],
        queryFn: async () => {
            // Fetch transactions with a limit, assuming API supports pagination or we slice client-side
            const response = await apiClient.get('/transactions');
            // Sort by date desc and take top 5
            return response.data;
        },
        enabled: shouldFetch,
    });

    const transactions = (providedTransactions ?? fetchedTransactions ?? [])
        .slice()
        .sort((a, b) => {
            const aDate = new Date(a.transactionDate ?? a.createdAt ?? 0).getTime();
            const bDate = new Date(b.transactionDate ?? b.createdAt ?? 0).getTime();
            return bDate - aDate;
        })
        .slice(0, 5);
    const loading = providedLoading ?? (shouldFetch && isLoading);

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !transactions || transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No recent transactions
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transactions.map((tx) => {
                            const txType = tx.paymentMethod ?? tx.type;
                            const pillClass =
                                txType === 'CASH_EXCHANGE'
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                    : txType === 'BANK_TRANSFER'
                                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                        : 'bg-muted text-muted-foreground';
                            return (
                            <div key={tx.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${pillClass}`}>
                                        {txType === 'BANK_TRANSFER' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-none">
                                            {tx.client?.name || 'Walk-in Customer'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {tx.transactionDate || tx.createdAt
                                                ? formatDistanceToNow(new Date(tx.transactionDate ?? tx.createdAt ?? 0), { addSuffix: true })
                                                : 'Date unavailable'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium">
                                        {tx.sendAmount.toLocaleString()} {tx.sendCurrency}
                                    </p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        <PrintReceiptButton
                                            remittanceId={tx.id}
                                            type="outgoing"
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-gray-400 hover:text-gray-600"
                                        />
                                        <span className="text-xs text-muted-foreground">→</span>
                                        <p className="text-xs font-medium text-muted-foreground">
                                            {tx.receiveAmount.toLocaleString()} {tx.receiveCurrency}
                                        </p>
                                    </div>

                                </div>
                            </div>
                        );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
