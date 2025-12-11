'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { TransactionPaymentsSection } from '@/src/components/payments';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { CreditCard } from 'lucide-react';

interface ManagePaymentsDialogProps {
    transaction: PickupTransaction | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ManagePaymentsDialog({ transaction, open, onOpenChange }: ManagePaymentsDialogProps) {
    if (!transaction) return null;

    // Cast PickupTransaction to any to satisfy TransactionPaymentsSection props for now
    // In a real scenario, we should align the types or make the component generic
    const transactionAdapter = {
        ...transaction,
        id: transaction.transactionId || transaction.id.toString(), // Use transactionId (UUID) if available, else fallback to id
    } as any;

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
