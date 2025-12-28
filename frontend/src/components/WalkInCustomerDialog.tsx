'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/src/components/ui/radio-group';
import { Label } from '@/src/components/ui/label';
import { Loader2, DollarSign, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/src/lib/api-client';
import { getErrorMessage } from '@/src/lib/error';

const walkInCustomerSchema = z.object({
    // Customer Information
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().min(10, 'Phone must be at least 10 digits'),
    address: z.string().optional(),
    idType: z.enum(['passport', 'national_id', 'drivers_license', 'other']),
    idNumber: z.string().min(5, 'ID number must be at least 5 characters'),

    // Transaction Type
    transactionType: z.enum(['transfer', 'cash_exchange']),

    // Transaction Details
    amount: z.string().min(1, 'Amount is required'),
    fromCurrency: z.string().min(2, 'Currency required'),
    toCurrency: z.string().min(2, 'Currency required'),
    exchangeRate: z.string().optional(),
    fees: z.string().optional(),
    notes: z.string().optional(),
});

type WalkInCustomerFormValues = z.infer<typeof walkInCustomerSchema>;

interface WalkInCustomerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTransactionCreated?: () => void;
}

export function WalkInCustomerDialog({
    open,
    onOpenChange,
    onTransactionCreated,
}: WalkInCustomerDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<WalkInCustomerFormValues>({
        resolver: zodResolver(walkInCustomerSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            address: '',
            idType: 'passport',
            idNumber: '',
            transactionType: 'transfer',
            amount: '',
            fromCurrency: 'USD',
            toCurrency: 'USD',
            exchangeRate: '1',
            fees: '0',
            notes: '',
        },
    });

    const transactionType = form.watch('transactionType');
    const fromCurrency = form.watch('fromCurrency');
    const toCurrency = form.watch('toCurrency');
    const amount = form.watch('amount');
    const exchangeRate = form.watch('exchangeRate');

    // Calculate receiver amount for cash exchange
    const calculatedAmount =
        transactionType === 'cash_exchange' && amount && exchangeRate
            ? (parseFloat(amount) * parseFloat(exchangeRate || '1')).toFixed(2)
            : amount;

    async function onSubmit(data: WalkInCustomerFormValues) {
        try {
            setIsSubmitting(true);

            // First, create or find customer
            const customerResponse = await apiClient.post('/customers/find-or-create', {
                name: data.name,
                email: data.email || undefined,
                phone: data.phone,
                address: data.address || undefined,
                idType: data.idType,
                idNumber: data.idNumber,
            });

            const customer = customerResponse.data;

            // Create transaction with correct schema matching backend Transaction model
            const sendAmount = parseFloat(data.amount);
            const rate = parseFloat(data.exchangeRate || '1');
            const fee = parseFloat(data.fees || '0');
            const receiveAmount = data.transactionType === 'cash_exchange'
                ? (sendAmount - fee) * rate
                : sendAmount;

            await apiClient.post('/transactions', {
                clientId: customer.id,
                paymentMethod: 'WALK_IN_CUSTOMER',
                sendCurrency: data.fromCurrency,
                sendAmount: sendAmount,
                receiveCurrency: data.transactionType === 'cash_exchange' ? data.toCurrency : data.fromCurrency,
                receiveAmount: receiveAmount,
                rateApplied: rate,
                feeCharged: fee,
                beneficiaryName: data.name,
                beneficiaryDetails: data.phone,
                userNotes: data.transactionType === 'transfer'
                    ? `Walk-in transfer - ${data.notes || 'No notes'}`
                    : `Cash exchange: ${data.amount} ${data.fromCurrency} → ${receiveAmount.toFixed(2)} ${data.toCurrency} @ rate ${rate} - ${data.notes || ''}`,
            });

            toast.success('Walk-in transaction created successfully!');
            form.reset();
            onOpenChange(false);
            onTransactionCreated?.();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to create transaction'));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Walk-in Customer Transaction</DialogTitle>
                    <DialogDescription>
                        Complete transaction for a walk-in customer
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Customer Information Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-2">Customer Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="John Doe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone Number *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+1 234 567 8900" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email (Optional)</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="john@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="123 Main St" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="idType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ID Type *</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select ID type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="passport">Passport</SelectItem>
                                                        <SelectItem value="national_id">National ID</SelectItem>
                                                        <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
                                                        <SelectItem value="other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="idNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ID Number *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="ID12345678" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Transaction Type Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-2">Transaction Type</h3>

                            <FormField
                                control={form.control}
                                name="transactionType"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="grid grid-cols-2 gap-4"
                                            >
                                                <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                                                    <RadioGroupItem value="transfer" id="transfer" />
                                                    <Label htmlFor="transfer" className="flex items-center gap-2 cursor-pointer">
                                                        <ArrowRightLeft className="h-4 w-4" />
                                                        Money Transfer
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                                                    <RadioGroupItem value="cash_exchange" id="cash_exchange" />
                                                    <Label htmlFor="cash_exchange" className="flex items-center gap-2 cursor-pointer">
                                                        <DollarSign className="h-4 w-4" />
                                                        Cash Exchange
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Transaction Details Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-2">Transaction Details</h3>

                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount *</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" placeholder="100.00" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="fromCurrency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>From Currency *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="USD" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {transactionType === 'cash_exchange' && (
                                    <FormField
                                        control={form.control}
                                        name="toCurrency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>To Currency *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="EUR" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>

                            {transactionType === 'cash_exchange' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="exchangeRate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Exchange Rate</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.0001" placeholder="1.2000" {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        1 {fromCurrency} = {field.value} {toCurrency}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="fees"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Fees</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                                    </FormControl>
                                                    <FormDescription>Transaction fees in {fromCurrency}</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Calculated Amount Display */}
                                    {amount && exchangeRate && (
                                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                                            <p className="text-sm text-muted-foreground">Customer will receive:</p>
                                            <p className="text-2xl font-bold text-primary">
                                                {calculatedAmount} {toCurrency}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Additional notes about this transaction..."
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Transaction
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
