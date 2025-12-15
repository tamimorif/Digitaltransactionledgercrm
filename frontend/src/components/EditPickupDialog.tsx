'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Edit } from 'lucide-react';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { handleNumberInput, parseFormattedNumber, formatNumberWithCommas } from '@/src/lib/format';
import { calculateReceivedAmount } from '@/src/lib/transaction-helpers';

interface EditPickupDialogProps {
    transaction: PickupTransaction | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

export function EditPickupDialog({ transaction, open, onOpenChange, onSuccess }: EditPickupDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        currency: '',
        receiverCurrency: '',
        exchangeRate: '1',
        receiverAmount: '',
        fees: '',
        allowPartialPayment: false,
        editReason: '',
    });

    // Initialize form when transaction changes
    useEffect(() => {
        if (transaction) {
            setFormData({
                amount: transaction.amount.toString(),
                currency: transaction.currency,
                receiverCurrency: transaction.receiverCurrency || transaction.currency,
                exchangeRate: transaction.exchangeRate?.toString() || '1',
                receiverAmount: transaction.receiverAmount?.toString() || transaction.amount.toString(),
                fees: transaction.fees?.toString() || '0',
                allowPartialPayment: transaction.allowPartialPayment || false,
                editReason: '',
            });
        }
    }, [transaction]);

    // Auto-calculate receiver amount when amount or exchange rate changes
    useEffect(() => {
        if (formData.amount && formData.exchangeRate) {
            const amount = parseFloat(formData.amount);
            const rate = parseFloat(formData.exchangeRate);
            if (!isNaN(amount) && !isNaN(rate)) {
                const calculatedAmount = calculateReceivedAmount(
                    amount,
                    rate,
                    false, // isCardSwap - we can infer this or pass it if needed, but for general edit, false is safer unless we check transaction type
                    formData.currency
                );
                setFormData(prev => ({
                    ...prev,
                    receiverAmount: calculatedAmount.toFixed(2)
                }));
            }
        }
    }, [formData.amount, formData.exchangeRate, formData.currency]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!transaction) return;

        if (!formData.editReason || formData.editReason.trim().length < 10) {
            toast.error('Please provide a detailed reason for editing (minimum 10 characters)');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`http://localhost:8080/api/pickups/${transaction.id}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                },
                body: JSON.stringify({
                    amount: parseFloat(formData.amount),
                    currency: formData.currency,
                    receiverCurrency: formData.receiverCurrency,
                    exchangeRate: parseFloat(formData.exchangeRate),
                    receiverAmount: parseFloat(formData.receiverAmount),
                    fees: parseFloat(formData.fees),
                    allowPartialPayment: formData.allowPartialPayment,
                    editReason: formData.editReason.trim(),
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to edit transaction');
            }

            toast.success('Transaction edited successfully');
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to edit transaction');
        } finally {
            setIsLoading(false);
        }
    };

    if (!transaction) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="h-5 w-5" />
                        Edit Transaction
                    </DialogTitle>
                    <DialogDescription>
                        Make corrections to transaction #{transaction.pickupCode}
                    </DialogDescription>
                </DialogHeader>

                <Alert>
                    <AlertDescription>
                        <strong>Important:</strong> Only pending transactions can be edited. Changes will be logged with your user ID and timestamp.
                    </AlertDescription>
                </Alert>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Current Transaction Info */}
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                        <h3 className="font-medium text-sm">Current Transaction</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-muted-foreground">From:</span> {transaction.senderName}
                            </div>
                            <div>
                                <span className="text-muted-foreground">To:</span> {transaction.recipientName}
                            </div>
                            <div>
                                <span className="text-muted-foreground">Original Amount:</span> {Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {transaction.currency}
                            </div>
                            <div>
                                <span className="text-muted-foreground">Status:</span> {transaction.status}
                            </div>
                        </div>
                    </div>

                    {/* Amount and Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-amount">Send Amount *</Label>
                            <Input
                                id="edit-amount"
                                type="text"
                                inputMode="decimal"
                                value={handleNumberInput(formData.amount)}
                                onChange={(e) => setFormData({ ...formData, amount: parseFormattedNumber(e.target.value) })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-currency">Currency *</Label>
                            <Select
                                value={formData.currency}
                                onValueChange={(value) => setFormData({ ...formData, currency: value })}
                            >
                                <SelectTrigger id="edit-currency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map(curr => (
                                        <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Exchange Rate Section */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-receiverCurrency">Receiver Currency</Label>
                            <Select
                                value={formData.receiverCurrency}
                                onValueChange={(value) => setFormData({ ...formData, receiverCurrency: value })}
                            >
                                <SelectTrigger id="edit-receiverCurrency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map(curr => (
                                        <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-exchangeRate">Exchange Rate</Label>
                            <Input
                                id="edit-exchangeRate"
                                type="text"
                                inputMode="decimal"
                                value={handleNumberInput(formData.exchangeRate)}
                                onChange={(e) => setFormData({ ...formData, exchangeRate: parseFormattedNumber(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                                1 {formData.currency} = {formData.exchangeRate} {formData.receiverCurrency}
                            </p>
                        </div>
                    </div>

                    {/* Receiver Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-receiverAmount">Receiver Amount</Label>
                        <Input
                            id="edit-receiverAmount"
                            type="text"
                            value={formatNumberWithCommas(formData.receiverAmount)}
                            readOnly
                        />
                        <p className="text-xs text-muted-foreground">
                            Automatically calculated based on exchange rate
                        </p>
                    </div>

                    {/* Fees */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-fees">Transaction Fees ({formData.currency}) *</Label>
                        <Input
                            id="edit-fees"
                            type="text"
                            inputMode="decimal"
                            value={handleNumberInput(formData.fees)}
                            onChange={(e) => setFormData({ ...formData, fees: parseFormattedNumber(e.target.value) })}
                            required
                        />
                    </div>

                    {/* Multi-Payment Toggle */}
                    <div className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                        <input
                            type="checkbox"
                            id="edit-allowPartialPayment"
                            checked={formData.allowPartialPayment}
                            onChange={(e) => setFormData({ ...formData, allowPartialPayment: e.target.checked })}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <Label htmlFor="edit-allowPartialPayment" className="cursor-pointer font-medium">
                                Enable Multi-Payment Mode
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Allows adding multiple partial payments for this transaction.
                            </p>
                        </div>
                    </div>

                    {/* Edit Reason */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-reason">Reason for Edit * (minimum 10 characters)</Label>
                        <Textarea
                            id="edit-reason"
                            value={formData.editReason}
                            onChange={(e) => setFormData({ ...formData, editReason: e.target.value })}
                            placeholder="e.g., Customer requested to change amount, incorrect exchange rate was used, etc."
                            rows={3}
                            required
                            minLength={10}
                        />
                        <p className="text-xs text-muted-foreground">
                            {formData.editReason.length}/10 minimum characters
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving Changes...
                                </>
                            ) : (
                                <>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
