'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { TrendingUp, DollarSign, Hash, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/src/lib/format';

interface TransactionSummaryProps {
    transactions: any[];
}

export function TransactionSummaryDashboard({ transactions }: TransactionSummaryProps) {
    const { t } = useTranslation();

    // Filter today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= today;
    });

    const totalTransactions = todayTransactions.length;
    const totalFees = todayTransactions.reduce((sum, tx) => sum + (parseFloat(tx.fees) || 0), 0);

    // Multi-payment statistics
    const multiPaymentTransactions = todayTransactions.filter(tx => tx.allowPartialPayment);
    const openPayments = multiPaymentTransactions.filter(tx => tx.paymentStatus === 'OPEN' || tx.paymentStatus === 'PARTIAL');
    const fullyPaidCount = multiPaymentTransactions.filter(tx => tx.paymentStatus === 'FULLY_PAID').length;

    // Group by currency
    const volumeByCurrency: { [key: string]: number } = {};
    todayTransactions.forEach(tx => {
        const currency = tx.currency || 'Unknown';
        volumeByCurrency[currency] = (volumeByCurrency[currency] || 0) + (parseFloat(tx.amount) || 0);
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {t('transaction.helpers.totalTransactions')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalTransactions}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('transaction.helpers.todayStats')}
                    </p>
                    {multiPaymentTransactions.length > 0 && (
                        <Badge variant="outline" className="mt-2 text-xs bg-blue-50 text-blue-700">
                            💳 {multiPaymentTransactions.length} multi-payment
                        </Badge>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {t('transaction.helpers.totalFees')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatCurrency(totalFees)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Combined fees
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Exchange Volume
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(volumeByCurrency).map(([currency, amount]) => (
                            <Badge key={currency} variant="secondary" className="text-xs">
                                {formatCurrency(amount)} {currency}
                            </Badge>
                        ))}
                        {Object.keys(volumeByCurrency).length === 0 && (
                            <span className="text-sm text-muted-foreground">No transactions yet</span>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Payment Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {multiPaymentTransactions.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Open/Partial:</span>
                                <Badge variant="outline" className="bg-orange-50 text-orange-700">
                                    {openPayments.length}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Fully Paid:</span>
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                    {fullyPaidCount}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Multi-payment tracking
                            </p>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">
                            No multi-payment transactions today
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
