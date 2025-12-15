'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
    PaymentList,
    AddPaymentDialog,
    CompleteTransactionDialog,
    PaymentProgressBar,
    QuickPaymentWidget
} from '@/src/components/payments';
import {
    usePayments,
    useCreatePayment,
    useCompleteTransaction
} from '@/src/lib/queries/payment.query';
import { Transaction } from '@/src/lib/models/client.model';
import { CheckCircle2 } from 'lucide-react';
import { canCompleteTransaction } from '@/src/lib/payment-api';

interface TransactionPaymentsSectionProps {
    transaction: Transaction;
}

export default function TransactionPaymentsSection({ transaction }: TransactionPaymentsSectionProps) {
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [quickPayAmount, setQuickPayAmount] = useState<number | null>(null);

    const { data: payments, isLoading } = usePayments(transaction.id);
    const createPaymentMutation = useCreatePayment(transaction.id);
    const completeTransactionMutation = useCompleteTransaction();

    // Get last payment info for repeat functionality
    const lastPayment = payments && payments.length > 0 ? payments[0] : null;

    const handleAddPayment = async (data: any) => {
        await createPaymentMutation.mutateAsync(data);
        setShowAddDialog(false);
        setQuickPayAmount(null);
    };

    const handleCompleteTransaction = async () => {
        await completeTransactionMutation.mutateAsync(transaction.id);
        setShowCompleteDialog(false);
    };

    const handleQuickPay = (amount: number, description: string) => {
        setQuickPayAmount(amount);
        setShowAddDialog(true);
    };

    const showCompleteButton =
        transaction.allowPartialPayment &&
        transaction.paymentStatus !== 'FULLY_PAID' &&
        canCompleteTransaction(transaction);

    const showQuickPayment =
        transaction.allowPartialPayment &&
        transaction.paymentStatus !== 'FULLY_PAID' &&
        (transaction.remainingBalance || 0) > 0;

    if (!transaction.allowPartialPayment) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Payments</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <p>This is a single-payment transaction.</p>
                        <p className="text-sm mt-2">
                            Multi-payment mode is not enabled for this transaction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Quick Payment Widget - NEW */}
            {showQuickPayment && (
                <QuickPaymentWidget
                    remainingBalance={transaction.remainingBalance || 0}
                    baseCurrency={transaction.receivedCurrency || 'CAD'}
                    onQuickPay={handleQuickPay}
                    lastPaymentAmount={lastPayment?.amount}
                    lastPaymentMethod={lastPayment?.paymentMethod}
                    isLoading={createPaymentMutation.isPending}
                />
            )}

            {/* Progress Bar */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Transaction Progress</CardTitle>
                        {showCompleteButton && (
                            <Button
                                onClick={() => setShowCompleteDialog(true)}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Complete Transaction
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <PaymentProgressBar transaction={transaction} showDetails />
                </CardContent>
            </Card>

            {/* Payments List */}
            <PaymentList
                payments={payments || []}
                isLoading={isLoading}
                onAddPayment={() => setShowAddDialog(true)}
                showAddButton={transaction.paymentStatus !== 'FULLY_PAID'}
            />

            {/* Add Payment Dialog with pre-filled amount from Quick Pay */}
            <AddPaymentDialog
                open={showAddDialog}
                onOpenChange={(open) => {
                    setShowAddDialog(open);
                    if (!open) setQuickPayAmount(null);
                }}
                transaction={transaction}
                onSubmit={handleAddPayment}
                isLoading={createPaymentMutation.isPending}
                prefillAmount={quickPayAmount}
            />

            {/* Complete Transaction Dialog */}
            <CompleteTransactionDialog
                open={showCompleteDialog}
                onOpenChange={setShowCompleteDialog}
                transaction={transaction}
                onConfirm={handleCompleteTransaction}
                isLoading={completeTransactionMutation.isPending}
            />
        </div>
    );
}
