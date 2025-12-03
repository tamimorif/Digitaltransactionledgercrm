import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Loader2, CheckCircle, AlertTriangle, Wallet } from 'lucide-react';
import { formatCurrency } from '@/src/lib/format';

interface TransactionPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isSubmitting: boolean;
    data: {
        transactionType: string;
        senderName: string;
        senderPhone: string;
        recipientName: string;
        recipientPhone?: string;
        recipientIban?: string;
        amount: string;
        senderCurrency: string;
        receiverCurrency?: string;
        exchangeRate?: string;
        receiverAmount?: number;
        fees: string;
        notes?: string;
        senderBranch?: string;
        receiverBranch?: string;
        allowPartialPayment?: boolean;
    };
}

export function TransactionPreviewDialog({
    open,
    onOpenChange,
    onConfirm,
    isSubmitting,
    data,
}: TransactionPreviewProps) {
    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'CASH_PICKUP': return '💱 Walk-In Exchange';
            case 'CARD_SWAP_IRR': return '💳 Card Cash-Out';
            case 'INCOMING_FUNDS': return '💵 Receive Money';
            case 'CASH_EXCHANGE': return '📤 Branch-to-Branch Transfer';
            case 'BANK_TRANSFER': return '🏦 Bank Deposit (Iran)';
            default: return type;
        }
    };

    const isInPerson = data.transactionType === 'CASH_PICKUP' || data.transactionType === 'CARD_SWAP_IRR' || data.transactionType === 'INCOMING_FUNDS';
    const isCardSwap = data.transactionType === 'CARD_SWAP_IRR';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Review Transaction
                    </DialogTitle>
                    <DialogDescription>
                        Please verify all details before submitting
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Transaction Type */}
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-muted-foreground">Transaction Type</p>
                        <p className="text-lg font-semibold">{getTypeLabel(data.transactionType)}</p>
                    </div>

                    {/* Customer/Sender Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                {isCardSwap ? 'Cardholder Name' : isInPerson ? 'Customer Name' : 'Sender Name'}
                            </p>
                            <p className="font-medium">{data.senderName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                {isCardSwap ? 'Cardholder Phone' : isInPerson ? 'Customer Phone' : 'Sender Phone'}
                            </p>
                            <p className="font-medium">{data.senderPhone}</p>
                        </div>
                    </div>

                    {/* Recipient Info (for transfers) */}
                    {!isInPerson && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div>
                                <p className="text-sm text-muted-foreground">Recipient Name</p>
                                <p className="font-medium">{data.recipientName}</p>
                            </div>
                            {data.recipientPhone && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Recipient Phone</p>
                                    <p className="font-medium">{data.recipientPhone}</p>
                                </div>
                            )}
                            {data.recipientIban && (
                                <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">IBAN</p>
                                    <p className="font-medium font-mono">{data.recipientIban}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Amount Details */}
                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">
                                {data.transactionType === 'CARD_SWAP_IRR' ? 'Card Swiped' : isInPerson ? 'Amount Given' : 'Send Amount'}
                            </span>
                            <span className="text-xl font-bold text-blue-600">
                                {formatCurrency(data.amount)} {data.senderCurrency}
                            </span>
                        </div>

                        {data.exchangeRate && parseFloat(data.exchangeRate) !== 1 && (
                            <>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Exchange Rate</span>
                                    <span className="font-medium">
                                        {isCardSwap || data.senderCurrency === 'IRR'
                                            ? `${parseFloat(data.exchangeRate).toLocaleString()} ${data.senderCurrency} = 1 ${data.receiverCurrency}`
                                            : `1 ${data.senderCurrency} = ${data.exchangeRate} ${data.receiverCurrency}`
                                        }
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t">
                                    <span className="text-muted-foreground">
                                        {data.transactionType === 'CARD_SWAP_IRR' ? 'Cash Given' : isInPerson ? 'Customer Receives' : 'Recipient Receives'}
                                    </span>
                                    <span className="text-xl font-bold text-green-600">
                                        {formatCurrency(data.receiverAmount || 0)} {data.receiverCurrency}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between items-center text-sm pt-2 border-t">
                            <span className="text-muted-foreground">Transaction Fees</span>
                            <span className="font-medium">{formatCurrency(data.fees)} {data.senderCurrency}</span>
                        </div>
                    </div>

                    {/* Branch Info */}
                    {(data.senderBranch || data.receiverBranch) && (
                        <div className="grid grid-cols-2 gap-4">
                            {data.senderBranch && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Your Branch</p>
                                    <p className="font-medium">{data.senderBranch}</p>
                                </div>
                            )}
                            {data.receiverBranch && data.receiverBranch !== data.senderBranch && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Receiver Branch</p>
                                    <p className="font-medium">{data.receiverBranch}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    {data.notes && (
                        <div>
                            <p className="text-sm text-muted-foreground">Notes</p>
                            <p className="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded border">{data.notes}</p>
                        </div>
                    )}

                    {/* Payment Mode Info */}
                    {data.allowPartialPayment && (
                        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                            <Wallet className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-900 dark:text-blue-100">
                                <p className="font-medium">Multi-Payment Transaction</p>
                                <p className="text-blue-700 dark:text-blue-300">
                                    This transaction allows partial payments. You can add multiple payments in different currencies until the full amount is received.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-900 dark:text-yellow-100">
                            <p className="font-medium">Please verify all information</p>
                            <p className="text-yellow-700 dark:text-yellow-300">This creates the initial transaction record. {data.allowPartialPayment ? 'Payments can be added after creation.' : 'Payment will be recorded immediately.'}</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Go Back
                    </Button>
                    <Button onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirm Transaction
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
