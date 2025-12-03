'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { FormattedInput } from '@/src/components/ui/formatted-input';
import { Textarea } from '@/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Loader2, DollarSign, RefreshCw, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import {
    useGetAllBalances,
    useGetActiveCurrencies,
    useRefreshAllBalances,
    useCreateAdjustment,
} from '@/src/lib/queries/cash-balance.query';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useTranslation } from '@/src/contexts/TranslationContext';

export function DashboardCashBalance() {
    const [showAdjustDialog, setShowAdjustDialog] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState('');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustReason, setAdjustReason] = useState('');

    const { user } = useAuth();
    const { t } = useTranslation();
    const { data: cashBalances, isLoading: balancesLoading, refetch: refetchBalances } = useGetAllBalances();
    const { data: currencies } = useGetActiveCurrencies();
    const refreshAllMutation = useRefreshAllBalances();
    const createAdjustmentMutation = useCreateAdjustment();

    return (
        <Card className="h-full border-l-4 border-l-primary">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Cash Balance
                        </CardTitle>
                        <CardDescription>Current cash on hand</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                                try {
                                    await refreshAllMutation.mutateAsync();
                                    toast.success('Balances refreshed');
                                    refetchBalances();
                                } catch (error: any) {
                                    toast.error('Failed to refresh');
                                }
                            }}
                            disabled={refreshAllMutation.isPending}
                            title="Refresh Balances"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Set default currency - either from API or fallback to CAD
                                if (currencies && currencies.length > 0) {
                                    setSelectedCurrency(currencies[0]);
                                } else {
                                    setSelectedCurrency('CAD'); // Default fallback
                                }
                                setShowAdjustDialog(true);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('cashBalance.adjust')}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {balancesLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : !cashBalances || cashBalances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No cash balances yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cashBalances.map((balance: any) => (
                            <div key={`${balance.branchID}-${balance.currency}`} className="p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <Badge variant="outline" className="text-xs font-bold">
                                        {balance.currency}
                                    </Badge>
                                    {balance.calculatedBalance !== balance.manualBalance && (
                                        <span className="h-2 w-2 rounded-full bg-yellow-500" title="Adjusted" />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <div className="text-2xl font-bold tracking-tight">
                                        {balance.manualBalance.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </div>
                                    {balance.calculatedBalance !== balance.manualBalance && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <span>Calc: {balance.calculatedBalance.toLocaleString()}</span>
                                            {balance.manualBalance > balance.calculatedBalance ? (
                                                <TrendingUp className="h-3 w-3 text-green-600" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3 text-red-600" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Adjustment Dialog */}
            <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust Cash Balance</DialogTitle>
                        <DialogDescription>
                            Manually adjust the cash balance for a specific currency
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                                <SelectTrigger id="currency">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {!currencies || currencies.length === 0 ? (
                                        <>
                                            {/* Fallback common currencies if API fails */}
                                            <SelectItem value="CAD">CAD</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="EUR">EUR</SelectItem>
                                            <SelectItem value="GBP">GBP</SelectItem>
                                            <SelectItem value="IRR">IRR</SelectItem>
                                        </>
                                    ) : (
                                        currencies.map((currency: string) => (
                                            <SelectItem key={currency} value={currency}>
                                                {currency}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Adjustment Amount</Label>
                            <FormattedInput
                                id="amount"
                                placeholder="Enter amount (+/-)"
                                value={adjustAmount}
                                onChange={(formatted, numeric) => setAdjustAmount(numeric.toString())}
                                allowNegative={true}
                                allowDecimals={true}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason</Label>
                            <Textarea
                                id="reason"
                                placeholder="Reason for adjustment..."
                                value={adjustReason}
                                onChange={(e) => setAdjustReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!selectedCurrency || !adjustAmount || !adjustReason) {
                                    toast.error('Please fill in all fields');
                                    return;
                                }
                                try {
                                    await createAdjustmentMutation.mutateAsync({
                                        branchId: user?.primaryBranchId || undefined,
                                        currency: selectedCurrency,
                                        amount: parseFloat(adjustAmount),
                                        reason: adjustReason,
                                    });
                                    toast.success('Balance adjusted');
                                    setShowAdjustDialog(false);
                                    setAdjustAmount('');
                                    setAdjustReason('');
                                    refetchBalances();
                                } catch (error: any) {
                                    toast.error('Failed to adjust');
                                }
                            }}
                            disabled={createAdjustmentMutation.isPending}
                        >
                            {createAdjustmentMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
