'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { TrendingUp, DollarSign, Hash, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/src/lib/format';

interface TransactionSummaryItem {
    createdAt: string;
    fees?: number | string;
    allowPartialPayment?: boolean;
    paymentStatus?: string;
    currency?: string;
    amount?: number | string;
}

interface TransactionSummaryProps {
    transactions: TransactionSummaryItem[];
    compact?: boolean;
}

export function TransactionSummaryDashboard({ transactions, compact = false }: TransactionSummaryProps) {
    const { t } = useTranslation();

    // Filter today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= today;
    });

    const totalTransactions = todayTransactions.length;
    const totalFees = todayTransactions.reduce((sum, tx) => sum + (Number(tx.fees) || 0), 0);

    // Multi-payment statistics
    const multiPaymentTransactions = todayTransactions.filter(tx => tx.allowPartialPayment);
    const openPayments = multiPaymentTransactions.filter(tx => tx.paymentStatus === 'OPEN' || tx.paymentStatus === 'PARTIAL');
    const fullyPaidCount = multiPaymentTransactions.filter(tx => tx.paymentStatus === 'FULLY_PAID').length;

    // Group by currency
    const volumeByCurrency: { [key: string]: number } = {};
    todayTransactions.forEach(tx => {
        const currency = tx.currency || 'Unknown';
        volumeByCurrency[currency] = (volumeByCurrency[currency] || 0) + (Number(tx.amount) || 0);
    });

    const gridClass = compact
        ? 'grid grid-cols-1 gap-3'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
    const headerClass = compact ? 'pb-1 pt-4 px-4' : 'pb-2';
    const contentClass = compact ? 'px-4 pb-4' : '';
    const titleClass = compact ? 'text-xs font-semibold uppercase tracking-wide text-muted-foreground' : 'text-sm font-medium text-muted-foreground';
    const valueClass = compact ? 'text-xl font-semibold' : 'text-2xl font-bold';

    return (
        <div className={gridClass}>
            <Card>
                <CardHeader className={headerClass}>
                    <CardTitle className={`${titleClass} flex items-center gap-2`}>
                        <Hash className="h-4 w-4" />
                        {t('transaction.helpers.totalTransactions')}
                    </CardTitle>
                </CardHeader>
                <CardContent className={contentClass}>
                    <div className={valueClass}>{totalTransactions}</div>
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
                <CardHeader className={headerClass}>
                    <CardTitle className={`${titleClass} flex items-center gap-2`}>
                        <DollarSign className="h-4 w-4" />
                        {t('transaction.helpers.totalFees')}
                    </CardTitle>
                </CardHeader>
                <CardContent className={contentClass}>
                    <div className={valueClass}>
                        {formatCurrency(totalFees)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Combined fees
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className={headerClass}>
                    <CardTitle className={`${titleClass} flex items-center gap-2`}>
                        <TrendingUp className="h-4 w-4" />
                        Exchange Volume
                    </CardTitle>
                </CardHeader>
                <CardContent className={contentClass}>
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
                <CardHeader className={headerClass}>
                    <CardTitle className={`${titleClass} flex items-center gap-2`}>
                        <Wallet className="h-4 w-4" />
                        Payment Status
                    </CardTitle>
                </CardHeader>
                <CardContent className={contentClass}>
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
