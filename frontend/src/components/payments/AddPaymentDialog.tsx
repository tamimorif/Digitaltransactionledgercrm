'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '../ui/form';
import { Input } from '../ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { PAYMENT_METHODS } from '@/src/lib/models/payment.model';
import { Transaction } from '@/src/lib/models/client.model';
import { Loader2 } from 'lucide-react';

const paymentSchema = z.object({
    amount: z.string().min(1, 'Amount is required').refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
    }, 'Amount must be a positive number'),
    currency: z.string().min(1, 'Currency is required'),
    exchangeRate: z.string().min(1, 'Exchange rate is required').refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
    }, 'Exchange rate must be a positive number'),
    paymentMethod: z.string().min(1, 'Payment method is required'),
    notes: z.string().optional(),
    receiptNumber: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: Transaction;
    onSubmit: (data: any) => Promise<void>;
    isLoading?: boolean;
}

const COMMON_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'IRR', 'AED'];

export function AddPaymentDialog({
    open,
    onOpenChange,
    transaction,
    onSubmit,
    isLoading = false,
}: AddPaymentDialogProps) {
    const [calculatedBase, setCalculatedBase] = useState<number>(0);

    const form = useForm<PaymentFormData>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            amount: '',
            currency: transaction.receivedCurrency || 'CAD',
            exchangeRate: '1',
            paymentMethod: 'CASH',
            notes: '',
            receiptNumber: '',
        },
    });

    const watchAmount = form.watch('amount');
    const watchRate = form.watch('exchangeRate');
    const watchCurrency = form.watch('currency');

    // Calculate amount in base currency
    useState(() => {
        const amount = parseFloat(watchAmount || '0');
        const rate = parseFloat(watchRate || '1');
        if (!isNaN(amount) && !isNaN(rate)) {
            setCalculatedBase(amount * rate);
        }
    });

    const handleSubmit = async (data: PaymentFormData) => {
        await onSubmit({
            amount: parseFloat(data.amount),
            currency: data.currency,
            exchangeRate: parseFloat(data.exchangeRate),
            paymentMethod: data.paymentMethod,
            notes: data.notes || undefined,
            receiptNumber: data.receiptNumber || undefined,
        });
        form.reset();
    };

    const remaining = transaction.remainingBalance || 0;
    const baseCurrency = transaction.receivedCurrency || 'CAD';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Payment</DialogTitle>
                    <DialogDescription>
                        Add a new payment for this transaction. Remaining balance: {' '}
                        <span className="font-semibold text-primary">
                            {remaining.toLocaleString()} {baseCurrency}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount *</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Currency *</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {COMMON_CURRENCIES.map((curr) => (
                                                    <SelectItem key={curr} value={curr}>
                                                        {curr}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="exchangeRate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Exchange Rate *</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.000001"
                                            placeholder="1.0"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        1 {watchCurrency} = {watchRate} {baseCurrency}
                                        {calculatedBase > 0 && (
                                            <span className="ml-2 font-semibold">
                                                ({calculatedBase.toLocaleString()} {baseCurrency})
                                            </span>
                                        )}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="paymentMethod"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Payment Method *</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select method" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {PAYMENT_METHODS.map((method) => (
                                                <SelectItem key={method.value} value={method.value}>
                                                    {method.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="receiptNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Receipt Number (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="RCP-12345" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add any additional notes..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Payment
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
