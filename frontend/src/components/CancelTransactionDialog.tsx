'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useCancelTransaction } from '@/src/lib/queries/client.query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/src/lib/error';

interface CancelTransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transactionId: string;
    onSuccess?: () => void;
}

export function CancelTransactionDialog({
    open,
    onOpenChange,
    transactionId,
    onSuccess,
}: CancelTransactionDialogProps) {
    const [reason, setReason] = useState('');
    const cancelMutation = useCancelTransaction();

    const handleCancel = async () => {
        if (!reason.trim()) {
            toast.error('Please provide a cancellation reason');
            return;
        }

        try {
            await cancelMutation.mutateAsync({
                transactionId,
                reason: reason.trim(),
            });

            toast.success('Transaction cancelled successfully');
            setReason('');
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to cancel transaction'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Cancel Transaction
                    </DialogTitle>
                    <DialogDescription>
                        This will mark the transaction as cancelled. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Cancellation Reason *</Label>
                        <Textarea
                            id="reason"
                            placeholder="Enter the reason for cancelling this transaction..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            disabled={cancelMutation.isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                            Provide a clear reason for audit purposes
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={cancelMutation.isPending}
                    >
                        Close
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={cancelMutation.isPending || !reason.trim()}
                    >
                        {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Cancel Transaction
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
