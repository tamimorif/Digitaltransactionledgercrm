'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Loader2,
    CheckCircle2,
    ArrowRight,
    Layers
} from 'lucide-react';
import { PAYMENT_METHODS } from '@/src/lib/models/payment.model';

interface PendingTransaction {
    id: string;
    clientName: string;
    remainingBalance: number;
    currency: string;
}

interface BatchPaymentAllocation {
    transactionId: string;
    clientName: string;
    remainingBalance: number;
    allocatedAmount: number;
    currency: string;
    isFullPayment: boolean;
}

interface BatchPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transactions: PendingTransaction[];
    onSubmit: (data: {
        transactionIds: string[];
        totalAmount: number;
        currency: string;
        exchangeRate: number;
        paymentMethod: string;
        strategy: string;
        notes: string;
    }) => Promise<void>;
    onPreview?: (data: {
        transactionIds: string[];
        totalAmount: number;
        currency: string;
        exchangeRate: number;
        paymentMethod: string;
        strategy: string;
    }) => Promise<BatchPaymentAllocation[]>;
    isLoading?: boolean;
}

export function BatchPaymentDialog({
    open,
    onOpenChange,
    transactions,
    onSubmit,
    onPreview,
    isLoading = false,
}: BatchPaymentDialogProps) {
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [totalAmount, setTotalAmount] = useState<string>('');
    const [currency] = useState<string>('CAD');
    const [exchangeRate] = useState<string>('1');
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [strategy, setStrategy] = useState<string>('FIFO');
    const [notes] = useState<string>('');
    const [preview, setPreview] = useState<BatchPaymentAllocation[] | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Calculate total remaining for selected transactions
    const selectedTotal = transactions
        .filter(t => selectedTransactions.includes(t.id))
        .reduce((sum, t) => sum + t.remainingBalance, 0);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedTransactions([]);
            setTotalAmount('');
            setPreview(null);
            setShowPreview(false);
        }
    }, [open]);

    const handleSelectAll = () => {
        if (selectedTransactions.length === transactions.length) {
            setSelectedTransactions([]);
        } else {
            setSelectedTransactions(transactions.map(t => t.id));
        }
    };

    const handleToggleTransaction = (id: string) => {
        if (selectedTransactions.includes(id)) {
            setSelectedTransactions(selectedTransactions.filter(tid => tid !== id));
        } else {
            setSelectedTransactions([...selectedTransactions, id]);
        }
    };

    const handlePayAll = () => {
        setTotalAmount(selectedTotal.toFixed(2));
    };

    const handlePreview = async () => {
        if (onPreview && selectedTransactions.length > 0 && parseFloat(totalAmount) > 0) {
            const allocations = await onPreview({
                transactionIds: selectedTransactions,
                totalAmount: parseFloat(totalAmount),
                currency,
                exchangeRate: parseFloat(exchangeRate),
                paymentMethod,
                strategy,
            });
            setPreview(allocations);
            setShowPreview(true);
        }
    };

    const handleSubmit = async () => {
        if (selectedTransactions.length === 0 || parseFloat(totalAmount) <= 0) {
            return;
        }

        await onSubmit({
            transactionIds: selectedTransactions,
            totalAmount: parseFloat(totalAmount),
            currency,
            exchangeRate: parseFloat(exchangeRate),
            paymentMethod,
            strategy,
            notes,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Batch Payment
                    </DialogTitle>
                    <DialogDescription>
                        Pay multiple transactions at once. Select transactions and enter total payment amount.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {!showPreview ? (
                        <div className="space-y-4">
                            {/* Transaction Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Select Transactions</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSelectAll}
                                    >
                                        {selectedTransactions.length === transactions.length
                                            ? 'Deselect All'
                                            : 'Select All'}
                                    </Button>
                                </div>
                                <ScrollArea className="h-48 border rounded-lg p-2">
                                    <div className="space-y-2">
                                        {transactions.map((transaction) => (
                                            <div
                                                key={transaction.id}
                                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedTransactions.includes(transaction.id)
                                                        ? 'bg-primary/10 border border-primary/20'
                                                        : 'hover:bg-muted'
                                                    }`}
                                                onClick={() => handleToggleTransaction(transaction.id)}
                                            >
                                                <Checkbox
                                                    checked={selectedTransactions.includes(transaction.id)}
                                                    onCheckedChange={() => handleToggleTransaction(transaction.id)}
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium">{transaction.clientName}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        ID: {transaction.id.slice(0, 8)}...
                                                    </p>
                                                </div>
                                                <Badge variant="outline">
                                                    {transaction.remainingBalance.toLocaleString()} {transaction.currency}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                {selectedTransactions.length > 0 && (
                                    <div className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-lg">
                                        <span>{selectedTransactions.length} transaction(s) selected</span>
                                        <span className="font-bold">
                                            Total: {selectedTotal.toLocaleString()} CAD
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Payment Amount */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Total Payment Amount</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={totalAmount}
                                            onChange={(e) => setTotalAmount(e.target.value)}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePayAll}
                                            disabled={selectedTransactions.length === 0}
                                        >
                                            Pay All
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Payment Method</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PAYMENT_METHODS.map((method) => (
                                                <SelectItem key={method.value} value={method.value}>
                                                    {method.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Allocation Strategy */}
                            <div className="space-y-2">
                                <Label>Allocation Strategy</Label>
                                <Select value={strategy} onValueChange={setStrategy}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FIFO">
                                            FIFO (Oldest First) - Recommended
                                        </SelectItem>
                                        <SelectItem value="PROPORTIONAL">
                                            Proportional - Split evenly by remaining
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        /* Preview Section */
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Payment Preview
                            </div>
                            <ScrollArea className="h-64">
                                <div className="space-y-2">
                                    {preview?.map((allocation) => (
                                        <Card key={allocation.transactionId}>
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">{allocation.clientName}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Remaining: {allocation.remainingBalance.toLocaleString()} {allocation.currency}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-primary">
                                                            <ArrowRight className="inline h-4 w-4 mr-1" />
                                                            {allocation.allocatedAmount.toLocaleString()} {allocation.currency}
                                                        </p>
                                                        {allocation.isFullPayment && (
                                                            <Badge variant="default" className="bg-green-600">
                                                                Full Payment
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {showPreview ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setShowPreview(false)}
                                disabled={isLoading}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Payment
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={onPreview ? handlePreview : handleSubmit}
                                disabled={isLoading || selectedTransactions.length === 0 || !totalAmount || parseFloat(totalAmount) <= 0}
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {onPreview ? 'Preview Allocation' : 'Process Payment'}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
