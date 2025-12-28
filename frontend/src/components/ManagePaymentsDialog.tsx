'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { TransactionPaymentsSection } from '@/src/components/payments';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { CreditCard } from 'lucide-react';
import { toPaymentTransaction } from '@/src/lib/transaction-adapter';

interface ManagePaymentsDialogProps {
    transaction: PickupTransaction | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ManagePaymentsDialog({ transaction, open, onOpenChange }: ManagePaymentsDialogProps) {
    if (!transaction) return null;

    const transactionAdapter = toPaymentTransaction(transaction);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Manage Payments
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    <TransactionPaymentsSection transaction={transactionAdapter} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
