'use client';

import { useState } from 'react';
import { DollarSign, RefreshCw, Plus, History, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Separator } from '@/src/components/ui/separator';
import {
    useGetAllBalances,
    useGetActiveCurrencies,
    useRefreshAllBalances,
    useCreateAdjustment,
    useGetAdjustmentHistory,
} from '@/src/lib/queries/cash-balance.query';
import { toast } from 'sonner';

export default function CashBalancePage() {
    const [showAdjustDialog, setShowAdjustDialog] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState('');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [historyPage, setHistoryPage] = useState(1);

    const { data: balances, isLoading: balancesLoading, refetch: refetchBalances } = useGetAllBalances();
    const { data: currencies } = useGetActiveCurrencies();
    const { data: historyData } = useGetAdjustmentHistory(undefined, undefined, historyPage, 10);

    const refreshAllMutation = useRefreshAllBalances();
    const createAdjustmentMutation = useCreateAdjustment();

    const handleRefreshAll = async () => {
        try {
            await refreshAllMutation.mutateAsync();
            toast.success('All balances refreshed successfully');
            refetchBalances();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to refresh balances');
        }
    };

    const handleOpenAdjustDialog = () => {
        if (currencies && currencies.length > 0) {
            setSelectedCurrency(currencies[0]);
        }
        setShowAdjustDialog(true);
    };

    const handleCreateAdjustment = async () => {
        if (!selectedCurrency || !adjustAmount || !adjustReason.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        const amount = parseFloat(adjustAmount);
        if (isNaN(amount)) {
            toast.error('Please enter a valid amount');
            return
        }

        try {
            await createAdjustmentMutation.mutateAsync({
                currency: selectedCurrency,
                amount,
                reason: adjustReason.trim(),
            });
            toast.success('Adjustment created successfully');
            setShowAdjustDialog(false);
            setAdjustAmount('');
            setAdjustReason('');
            refetchBalances();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create adjustment');
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return `${amount.toFixed(2)} ${currency}`;
    };

    return (
        <div className="container max-w-7xl py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Cash Balance Management</h1>
                    <p className="text-muted-foreground">Monitor and manage your cash balances by currency</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRefreshAll}
                        disabled={refreshAllMutation.isPending}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
                        Refresh All
                    </Button>
                    <Button onClick={handleOpenAdjustDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add/Adjust Cash
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="balances" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="balances">Current Balances</TabsTrigger>
                    <TabsTrigger value="history">Adjustment History</TabsTrigger>
                </TabsList>

                <TabsContent value="balances" className="space-y-4">
                    {balancesLoading ? (
                        <Card>
                            <CardContent className="py-12">
                                <div className="text-center text-muted-foreground">
                                    <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin opacity-50" />
                                    <p>Loading balances...</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : balances && balances.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {balances.map((balance) => (
                                <Card key={balance.id} className="border-2">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <DollarSign className="h-5 w-5 text-primary" />
                                                {balance.currency}
                                            </CardTitle>
                                            {balance.branch && (
                                                <Badge variant="outline">{balance.branch.name}</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Calculator className="h-3 w-3" />
                                                    Auto Calculated
                                                </Label>
                                                <span className="font-mono text-sm">
                                                    {formatCurrency(balance.autoCalculatedBalance, balance.currency)}
                                                </span>
                                            </div>

                                            {balance.manualAdjustment !== 0 && (
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                        {balance.manualAdjustment > 0 ? (
                                                            <TrendingUp className="h-3 w-3 text-green-600" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3 text-red-600" />
                                                        )}
                                                        Manual Adjustment
                                                    </Label>
                                                    <span className={`font-mono text-sm ${balance.manualAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {balance.manualAdjustment > 0 ? '+' : ''}
                                                        {formatCurrency(balance.manualAdjustment, balance.currency)}
                                                    </span>
                                                </div>
                                            )}

                                            <Separator />

                                            <div className="flex items-center justify-between">
                                                <Label className="font-semibold">Final Balance</Label>
                                                <span className="font-mono text-xl font-bold text-primary">
                                                    {formatCurrency(balance.finalBalance, balance.currency)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            Last calculated: {new Date(balance.lastCalculatedAt).toLocaleString()}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-12">
                                <div className="text-center text-muted-foreground">
                                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">No cash balances yet</p>
                                    <p className="text-sm mb-4">Click "Add/Adjust Cash" above to set your opening balance or add cash to the system</p>
                                    <Button onClick={handleOpenAdjustDialog} size="sm">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Opening Balance
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Adjustment History
                            </CardTitle>
                            <CardDescription>View all manual cash adjustments</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {historyData && historyData.data.length > 0 ? (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Currency</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Adjusted By</TableHead>
                                                <TableHead className="text-right">Balance After</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {historyData.data.map((adjustment) => (
                                                <TableRow key={adjustment.id}>
                                                    <TableCell className="text-sm">
                                                        {new Date(adjustment.createdAt).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{adjustment.currency}</Badge>
                                                    </TableCell>
                                                    <TableCell className={`text-right font-mono ${adjustment.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {adjustment.amount > 0 ? '+' : ''}
                                                        {adjustment.amount.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate">{adjustment.reason}</TableCell>
                                                    <TableCell className="text-sm">
                                                        {adjustment.adjustedByUser?.fullName || 'Unknown'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {adjustment.balanceAfter.toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {historyData.totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4">
                                            <p className="text-sm text-muted-foreground">
                                                Page {historyData.page} of {historyData.totalPages}
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                                    disabled={historyPage === 1}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setHistoryPage(p => p + 1)}
                                                    disabled={historyPage === historyData.totalPages}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">No adjustment history</p>
                                    <p className="text-sm">Manual adjustments will appear here</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Adjustment Dialog */}
            <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add or Adjust Cash Balance</DialogTitle>
                        <DialogDescription>
                            Add opening balance, deposits, withdrawals, or make corrections. Use positive numbers to add cash, negative to subtract.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency *</Label>
                            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                                <SelectTrigger id="currency">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {currencies?.map((curr) => (
                                        <SelectItem key={curr} value={curr}>
                                            {curr}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount *</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                placeholder="Enter amount (positive to add, negative to subtract)"
                                value={adjustAmount}
                                onChange={(e) => setAdjustAmount(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Use positive numbers to add money, negative to subtract
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason *</Label>
                            <Textarea
                                id="reason"
                                placeholder="Explain why this adjustment is needed"
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
                            onClick={handleCreateAdjustment}
                            disabled={createAdjustmentMutation.isPending}
                        >
                            {createAdjustmentMutation.isPending ? 'Creating...' : 'Create Adjustment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
