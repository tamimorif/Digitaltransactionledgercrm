'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { 
    PaymentList, 
    AddPaymentDialog, 
    CompleteTransactionDialog,
    PaymentProgressBar 
} from '@/src/components/payments';
import { 
    usePayments, 
    useCreatePayment, 
    useCompleteTransaction 
} from '@/src/lib/queries/payment.query';
import { Transaction } from '@/src/lib/models/client.model';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { canCompleteTransaction } from '@/src/lib/payment-api';
import Link from 'next/link';

interface TransactionPaymentsSectionProps {
    transaction: Transaction;
}

export default function TransactionPaymentsSection({ transaction }: TransactionPaymentsSectionProps) {
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);

    const { data: payments, isLoading } = usePayments(transaction.id);
    const createPaymentMutation = useCreatePayment(transaction.id);
    const completeTransactionMutation = useCompleteTransaction();

    const handleAddPayment = async (data: any) => {
        await createPaymentMutation.mutateAsync(data);
        setShowAddDialog(false);
    };

    const handleCompleteTransaction = async () => {
        await completeTransactionMutation.mutateAsync(transaction.id);
        setShowCompleteDialog(false);
    };

    const showCompleteButton = 
        transaction.allowPartialPayment && 
        transaction.paymentStatus !== 'FULLY_PAID' &&
        canCompleteTransaction(transaction);

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

            {/* Add Payment Dialog */}
            <AddPaymentDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                transaction={transaction}
                onSubmit={handleAddPayment}
                isLoading={createPaymentMutation.isPending}
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
