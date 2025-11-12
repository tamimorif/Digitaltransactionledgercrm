'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import { useCreatePickupTransaction } from '@/src/lib/queries/pickup.query';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import { Alert, AlertDescription } from '@/src/components/ui/alert';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

export default function SendMoneyPickupPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Redirect SuperAdmin to admin dashboard
    useEffect(() => {
        if (user?.role === 'superadmin') {
            router.push('/admin');
        }
    }, [user, router]);

    const [formData, setFormData] = useState({
        senderName: '',
        senderPhone: '',
        recipientName: '',
        recipientPhone: '',
        receiverBranchId: '',
        amount: '',
        senderCurrency: '',
        receiverCurrency: '',
        exchangeRate: '1',
        fees: '',
        notes: '',
    });

    const [generatedCode, setGeneratedCode] = useState<string | null>(null);

    const { data: branches } = useGetBranches();
    const createPickupMutation = useCreatePickupTransaction();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.senderName || !formData.senderPhone ||
            !formData.recipientName || !formData.recipientPhone || !formData.receiverBranchId ||
            !formData.amount || !formData.senderCurrency || !formData.receiverCurrency || !formData.fees) {
            toast.error('Please fill in all required fields');
            return;
        }

        // For branch users, use their branch. For owners, they need to select a branch
        const senderBranchId = user?.role === 'tenant_owner'
            ? parseInt(formData.receiverBranchId) // Owner can send from any branch
            : user?.id; // Branch user sends from their own branch

        if (!senderBranchId) {
            toast.error('Please select a branch');
            return;
        }

        // Calculate receiver amount based on exchange rate
        const senderAmount = parseFloat(formData.amount);
        const exchangeRate = parseFloat(formData.exchangeRate);
        const receiverAmount = senderAmount * exchangeRate;

        try {
            const response = await createPickupMutation.mutateAsync({
                senderName: formData.senderName,
                senderPhone: formData.senderPhone,
                senderBranchId: senderBranchId,
                recipientName: formData.recipientName,
                recipientPhone: formData.recipientPhone,
                receiverBranchId: parseInt(formData.receiverBranchId),
                amount: senderAmount,
                currency: formData.senderCurrency,
                receiverCurrency: formData.receiverCurrency,
                exchangeRate: exchangeRate,
                receiverAmount: receiverAmount,
                fees: parseFloat(formData.fees),
                notes: formData.notes || undefined,
            }); setGeneratedCode(response.pickupCode);
            toast.success('Money pickup created successfully!');

            // Reset form
            setFormData({
                senderName: '',
                senderPhone: '',
                recipientName: '',
                recipientPhone: '',
                receiverBranchId: '',
                amount: '',
                senderCurrency: '',
                receiverCurrency: '',
                exchangeRate: '1',
                fees: '0',
                notes: '',
            });
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create money pickup');
        }
    };

    const handleCreateAnother = () => {
        setGeneratedCode(null);
    };

    // Don't render for SuperAdmin
    if (user?.role === 'superadmin') {
        return null;
    }

    if (generatedCode) {
        return (
            <div className="container max-w-2xl mx-auto py-8 space-y-6">
                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <CheckCircle className="h-16 w-16 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl text-green-900">Money Pickup Created!</CardTitle>
                        <CardDescription className="text-green-700">
                            Share this pickup code with the recipient
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-white border-2 border-green-300 rounded-lg p-8 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Pickup Code</p>
                            <p className="text-5xl font-bold text-green-600 tracking-widest">{generatedCode}</p>
                        </div>

                        <Alert>
                            <AlertDescription>
                                The recipient can use this code at the receiving branch to collect the money.
                                They will need to provide this code and verify their phone number.
                            </AlertDescription>
                        </Alert>

                        <Button onClick={handleCreateAnother} className="w-full">
                            Create Another Pickup
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container max-w-2xl mx-auto py-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Send Money</h1>
                <p className="text-muted-foreground">Send money to another branch for pickup</p>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Sender & Recipient Information</CardTitle>
                        <CardDescription>Enter sender and recipient details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Sender Name */}
                        <div className="space-y-2">
                            <Label htmlFor="senderName">Sender Name *</Label>
                            <Input
                                id="senderName"
                                value={formData.senderName}
                                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                placeholder="Sender's full name"
                                required
                            />
                        </div>

                        {/* Sender Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="senderPhone">Sender Phone *</Label>
                            <Input
                                id="senderPhone"
                                type="tel"
                                value={formData.senderPhone}
                                onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                                placeholder="+1234567890"
                                required
                            />
                        </div>

                        <div className="border-t my-4" />

                        {/* Recipient Name */}
                        <div className="space-y-2">
                            <Label htmlFor="recipientName">Recipient Name *</Label>
                            <Input
                                id="recipientName"
                                value={formData.recipientName}
                                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                placeholder="Full name of recipient"
                                required
                            />
                        </div>

                        {/* Recipient Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="recipientPhone">Recipient Phone *</Label>
                            <Input
                                id="recipientPhone"
                                type="tel"
                                value={formData.recipientPhone}
                                onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                                placeholder="+1234567890"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                This will be used for verification at pickup
                            </p>
                        </div>

                        {/* Receiver Branch */}
                        <div className="space-y-2">
                            <Label htmlFor="receiverBranch">Receiving Branch *</Label>
                            <Select
                                value={formData.receiverBranchId}
                                onValueChange={(value) => setFormData({ ...formData, receiverBranchId: value })}
                            >
                                <SelectTrigger id="receiverBranch">
                                    <SelectValue placeholder="Select branch where money will be picked up" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches?.map((branch: any) => (
                                        <SelectItem key={branch.id} value={branch.id.toString()}>
                                            {branch.name} ({branch.branchCode})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Amount and Sender Currency */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Send Amount *</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="1000"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="senderCurrency">Sender Currency *</Label>
                                <Select
                                    value={formData.senderCurrency}
                                    onValueChange={(value) => setFormData({ ...formData, senderCurrency: value })}
                                >
                                    <SelectTrigger id="senderCurrency">
                                        <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map((curr) => (
                                            <SelectItem key={curr} value={curr}>
                                                {curr}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Receiver Currency and Exchange Rate */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="receiverCurrency">Receiver Currency *</Label>
                                <Select
                                    value={formData.receiverCurrency}
                                    onValueChange={(value) => setFormData({ ...formData, receiverCurrency: value })}
                                >
                                    <SelectTrigger id="receiverCurrency">
                                        <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map((curr) => (
                                            <SelectItem key={curr} value={curr}>
                                                {curr}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Currency recipient will receive
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="exchangeRate">Exchange Rate *</Label>
                                <Input
                                    id="exchangeRate"
                                    type="number"
                                    step="0.0001"
                                    value={formData.exchangeRate}
                                    onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                                    placeholder="1.0000"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    {formData.amount && formData.exchangeRate && formData.senderCurrency && formData.receiverCurrency
                                        ? `Receiver gets: ${(parseFloat(formData.amount) * parseFloat(formData.exchangeRate)).toFixed(2)} ${formData.receiverCurrency}`
                                        : 'Rate: 1 sender = X receiver'}
                                </p>
                            </div>
                        </div>

                        {/* Fees */}
                        <div className="space-y-2">
                            <Label htmlFor="fees">Transfer Fees *</Label>
                            <Input
                                id="fees"
                                type="number"
                                step="0.01"
                                value={formData.fees}
                                onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                                placeholder="0.00"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Fees charged for this transfer
                            </p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any additional information..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex gap-3 mt-6">
                    <Button type="submit" disabled={createPickupMutation.isPending} className="flex-1">
                        {createPickupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Send className="mr-2 h-4 w-4" />
                        Create Pickup
                    </Button>
                </div>
            </form>
        </div>
    );
}
