'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGetClientBalances, useGetClientEntries, useAddLedgerEntry, useExchangeCurrency } from '@/src/lib/queries/ledger.query';
import { useGetClient } from '@/src/lib/queries/client.query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { ArrowLeft, Plus, ArrowRightLeft, Wallet, History, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY', 'USDT'];

export default function ClientLedgerPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.id as string;
    const clientIdNum = parseInt(clientId, 10);

    const { data: client, isLoading: isClientLoading } = useGetClient(clientIdNum);
    const { data: balances } = useGetClientBalances(clientId);
    const { data: entries } = useGetClientEntries(clientId);

    const addEntryMutation = useAddLedgerEntry(clientId);
    const exchangeMutation = useExchangeCurrency(clientId);

    const [showAddFunds, setShowAddFunds] = useState(false);
    const [showExchange, setShowExchange] = useState(false);
    const [showSettle, setShowSettle] = useState(false);

    // Form States
    const [addFundsData, setAddFundsData] = useState({
        type: 'DEPOSIT',
        currency: 'USD',
        amount: '',
        description: '',
    });

    const [exchangeData, setExchangeData] = useState({
        fromCurrency: 'USD',
        toCurrency: 'IRR',
        amount: '',
        rate: '',
        description: '',
    });

    const handleAddFunds = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addEntryMutation.mutateAsync({
                type: addFundsData.type as 'DEPOSIT' | 'WITHDRAWAL',
                currency: addFundsData.currency,
                amount: parseFloat(addFundsData.amount),
                description: addFundsData.description,
            });
            toast.success('Entry added successfully');
            setShowAddFunds(false);
            setAddFundsData({ type: 'DEPOSIT', currency: 'USD', amount: '', description: '' });
        } catch {
            toast.error('Failed to add entry');
        }
    };

    const handleExchange = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await exchangeMutation.mutateAsync({
                fromCurrency: exchangeData.fromCurrency,
                toCurrency: exchangeData.toCurrency,
                amount: parseFloat(exchangeData.amount),
                rate: parseFloat(exchangeData.rate),
                description: exchangeData.description,
            });
            toast.success('Exchange completed successfully');
            setShowExchange(false);
            setExchangeData({ fromCurrency: 'USD', toCurrency: 'IRR', amount: '', rate: '', description: '' });
        } catch {
            toast.error('Failed to complete exchange');
        }
    };

    if (isClientLoading) return <div className="p-8 text-center">Loading client...</div>;

    return (
        <div className="container mx-auto py-8 px-4 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{client?.name} Ledger</h1>
                        <p className="text-muted-foreground">Manage multi-currency balances and exchanges</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowAddFunds(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Funds / Withdraw
                    </Button>
                    <Button variant="secondary" onClick={() => setShowExchange(true)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Exchange
                    </Button>
                    <Button variant="outline" onClick={() => setShowSettle(true)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Settle Debt
                    </Button>
                </div>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {balances && Object.entries(balances).map(([currency, amount]) => (
                    <Card key={currency} className={amount < 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {currency} Balance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${amount < 0 ? 'text-red-700' : 'text-green-700'}`}>
                                {amount.toLocaleString()} {currency}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {amount < 0 ? 'Client owes you' : 'You owe client'}
                            </p>
                        </CardContent>
                    </Card>
                ))}
                {(!balances || Object.keys(balances).length === 0) && (
                    <Card className="col-span-full border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Wallet className="h-8 w-8 mb-2 opacity-50" />
                            <p>No active balances</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Ledger Entries Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Transaction History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead>Branch</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries?.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            entry.type === 'DEPOSIT' || entry.type === 'EXCHANGE_IN' ? 'default' :
                                                entry.type === 'WITHDRAWAL' || entry.type === 'EXCHANGE_OUT' ? 'destructive' : 'secondary'
                                        }>
                                            {entry.type.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{entry.description}</TableCell>
                                    <TableCell className={`text-right font-mono font-medium ${entry.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()} {entry.currency}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {entry.exchangeRate ? entry.exchangeRate.toLocaleString() : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {entry.branch?.name || '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!entries || entries.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No ledger entries found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add Funds Modal */}
            <Dialog open={showAddFunds} onOpenChange={setShowAddFunds}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Funds / Withdraw</DialogTitle>
                        <DialogDescription>Record a manual deposit or withdrawal for this client.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddFunds} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={addFundsData.type} onValueChange={(v) => setAddFundsData({ ...addFundsData, type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DEPOSIT">Deposit (Credit)</SelectItem>
                                        <SelectItem value="WITHDRAWAL">Withdrawal (Debit)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={addFundsData.currency} onValueChange={(v) => setAddFundsData({ ...addFundsData, currency: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Amount</Label>
                            <Input
                                type="number"
                                step="0.01"
                                required
                                value={addFundsData.amount}
                                onChange={(e) => setAddFundsData({ ...addFundsData, amount: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={addFundsData.description}
                                onChange={(e) => setAddFundsData({ ...addFundsData, description: e.target.value })}
                                placeholder="e.g. Cash deposit"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={addEntryMutation.isPending}>
                                {addEntryMutation.isPending ? 'Saving...' : 'Save Entry'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Exchange Modal */}
            <Dialog open={showExchange} onOpenChange={setShowExchange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Currency Exchange</DialogTitle>
                        <DialogDescription>Convert client funds from one currency to another.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleExchange} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>From (Sell)</Label>
                                <Select value={exchangeData.fromCurrency} onValueChange={(v) => setExchangeData({ ...exchangeData, fromCurrency: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>To (Buy)</Label>
                                <Select value={exchangeData.toCurrency} onValueChange={(v) => setExchangeData({ ...exchangeData, toCurrency: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount (From)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={exchangeData.amount}
                                    onChange={(e) => setExchangeData({ ...exchangeData, amount: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Exchange Rate</Label>
                                <Input
                                    type="number"
                                    step="0.000001"
                                    required
                                    value={exchangeData.rate}
                                    onChange={(e) => setExchangeData({ ...exchangeData, rate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={exchangeData.description}
                                onChange={(e) => setExchangeData({ ...exchangeData, description: e.target.value })}
                                placeholder="e.g. Daily exchange"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={exchangeMutation.isPending}>
                                {exchangeMutation.isPending ? 'Processing...' : 'Complete Exchange'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Settle Debt Modal (Reuse Exchange for now or separate if logic differs) */}
            <Dialog open={showSettle} onOpenChange={setShowSettle}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Settle Debt</DialogTitle>
                        <DialogDescription>Use one currency balance to pay off debt in another.</DialogDescription>
                    </DialogHeader>
                    <div className="p-4 text-center text-muted-foreground">
                        <p>Settlement logic is similar to Exchange. Use the Exchange function to convert credit in one currency to cover debt in another.</p>
                        <Button className="mt-4" onClick={() => { setShowSettle(false); setShowExchange(true); }}>
                            Open Exchange
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
