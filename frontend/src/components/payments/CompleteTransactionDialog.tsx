'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog';
import { Transaction } from '@/src/lib/models/client.model';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { canCompleteTransaction } from '@/src/lib/payment-api';

interface CompleteTransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: Transaction;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function CompleteTransactionDialog({
    open,
    onOpenChange,
    transaction,
    onConfirm,
    isLoading = false,
}: CompleteTransactionDialogProps) {
    const canComplete = canCompleteTransaction(transaction);
    const remaining = transaction.remainingBalance || 0;
    const total = transaction.totalReceived || 0;
    const paid = transaction.totalPaid || 0;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {canComplete ? (
                            <>
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                Complete Transaction?
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                Cannot Complete Transaction
                            </>
                        )}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-4">
                            {canComplete ? (
                                <>
                                    <p>
                                        You are about to mark this transaction as completed. 
                                        This will finalize all payments and lock the transaction.
                                    </p>
                                    
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Total Received:</span>
                                            <span className="font-semibold">
                                                {total.toLocaleString()} {transaction.receivedCurrency}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Total Paid:</span>
                                            <span className="font-semibold text-green-600">
                                                {paid.toLocaleString()} {transaction.receivedCurrency}
                                            </span>
                                        </div>
                                        {remaining > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Remaining:</span>
                                                <span className="font-semibold text-amber-600">
                                                    {remaining.toLocaleString()} {transaction.receivedCurrency}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {remaining > 0 && remaining <= (total * 0.01) && (
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                                            <AlertCircle className="w-4 h-4 inline mr-2" />
                                            There is a small remaining balance. This is within tolerance (1%) 
                                            and can be completed.
                                        </div>
                                    )}

                                    <p className="text-sm font-medium">
                                        Are you sure you want to complete this transaction?
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        This transaction cannot be completed yet because there is still 
                                        a significant remaining balance.
                                    </p>
                                    
                                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg space-y-2 border border-red-200 dark:border-red-800">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Total Received:</span>
                                            <span className="font-semibold">
                                                {total.toLocaleString()} {transaction.receivedCurrency}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Total Paid:</span>
                                            <span className="font-semibold">
                                                {paid.toLocaleString()} {transaction.receivedCurrency}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm font-semibold">
                                            <span className="text-red-600">Remaining:</span>
                                            <span className="text-red-600">
                                                {remaining.toLocaleString()} {transaction.receivedCurrency}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-sm">
                                        Please add more payments to reduce the remaining balance 
                                        to less than 1% of the total before completing.
                                    </p>
                                </>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>
                        {canComplete ? 'Cancel' : 'Close'}
                    </AlertDialogCancel>
                    {canComplete && (
                        <AlertDialogAction
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? 'Completing...' : 'Complete Transaction'}
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
