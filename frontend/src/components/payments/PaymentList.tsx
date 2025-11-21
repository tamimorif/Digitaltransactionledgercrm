'use client';

import { Payment } from '@/src/lib/models/payment.model';
import { PaymentCard } from './PaymentCard';
import { Button } from '../ui/button';
import { Plus, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface PaymentListProps {
    payments: Payment[];
    onAddPayment?: () => void;
    onEditPayment?: (payment: Payment) => void;
    onCancelPayment?: (payment: Payment) => void;
    showAddButton?: boolean;
    isLoading?: boolean;
}

export function PaymentList({
    payments,
    onAddPayment,
    onEditPayment,
    onCancelPayment,
    showAddButton = true,
    isLoading = false,
}: PaymentListProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Payments
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!payments || payments.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Payments
                        </CardTitle>
                        {showAddButton && onAddPayment && (
                            <Button onClick={onAddPayment} size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Payment
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No payments yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Start by adding your first payment to this transaction
                        </p>
                        {showAddButton && onAddPayment && (
                            <Button onClick={onAddPayment}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Payment
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Sort payments: Active first, then cancelled
    const sortedPayments = [...payments].sort((a, b) => {
        if (a.status === 'CANCELLED' && b.status !== 'CANCELLED') return 1;
        if (a.status !== 'CANCELLED' && b.status === 'CANCELLED') return -1;
        return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Payments ({payments.length})
                    </CardTitle>
                    {showAddButton && onAddPayment && (
                        <Button onClick={onAddPayment} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Payment
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {sortedPayments.map((payment) => (
                        <PaymentCard
                            key={payment.id}
                            payment={payment}
                            onEdit={onEditPayment}
                            onCancel={onCancelPayment}
                            showActions={payment.status !== 'CANCELLED'}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
