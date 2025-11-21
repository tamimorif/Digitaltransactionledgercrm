'use client';

import { Transaction } from '@/src/lib/models/client.model';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { 
    calculatePaymentProgress, 
    getPaymentStatusLabel, 
    getPaymentStatusColor 
} from '@/src/lib/payment-api';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface PaymentProgressBarProps {
    transaction: Transaction;
    showDetails?: boolean;
}

export function PaymentProgressBar({ transaction, showDetails = true }: PaymentProgressBarProps) {
    if (!transaction.allowPartialPayment) {
        return null;
    }

    const progress = calculatePaymentProgress(transaction);
    const statusLabel = getPaymentStatusLabel(transaction.paymentStatus);
    const statusColor = getPaymentStatusColor(transaction.paymentStatus);
    
    const total = transaction.totalReceived || 0;
    const paid = transaction.totalPaid || 0;
    const remaining = transaction.remainingBalance || 0;
    const currency = transaction.receivedCurrency || 'CAD';

    const getStatusIcon = () => {
        switch (transaction.paymentStatus) {
            case 'FULLY_PAID':
                return <CheckCircle2 className="w-4 h-4" />;
            case 'PARTIAL':
                return <Clock className="w-4 h-4" />;
            case 'OPEN':
                return <AlertCircle className="w-4 h-4" />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Payment Progress</span>
                    <Badge 
                        variant={statusColor as any}
                        className="flex items-center gap-1"
                    >
                        {getStatusIcon()}
                        {statusLabel}
                    </Badge>
                </div>
                <span className="text-sm font-semibold">
                    {progress}%
                </span>
            </div>

            <Progress value={progress} className="h-2" />

            {showDetails && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-semibold">
                            {total.toLocaleString()} {currency}
                        </div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Paid</div>
                        <div className="font-semibold text-green-600">
                            {paid.toLocaleString()} {currency}
                        </div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Remaining</div>
                        <div className="font-semibold text-amber-600">
                            {remaining.toLocaleString()} {currency}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
