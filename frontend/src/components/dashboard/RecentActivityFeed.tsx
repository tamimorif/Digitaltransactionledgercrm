'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/src/lib/api-client';
import { Loader2, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { PrintReceiptButton } from '../receipts/ReceiptButtons';


export function RecentActivityFeed() {
    const { data: transactions, isLoading } = useQuery({
        queryKey: ['recent-transactions'],
        queryFn: async () => {
            // Fetch transactions with a limit, assuming API supports pagination or we slice client-side
            const response = await apiClient.get('/transactions');
            // Sort by date desc and take top 5
            return response.data
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5);
        },
    });

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !transactions || transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No recent transactions
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transactions.map((tx: any) => (
                            <div key={tx.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${tx.type === 'CASH_EXCHANGE' ? 'bg-blue-100 text-blue-600' :
                                        tx.type === 'BANK_TRANSFER' ? 'bg-purple-100 text-purple-600' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                        {tx.type === 'BANK_TRANSFER' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-none">
                                            {tx.client?.name || 'Walk-in Customer'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
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
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
