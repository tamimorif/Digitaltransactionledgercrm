'use client';

import { useState } from 'react';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
    useCreateReconciliation,
    useGetReconciliationHistory,
    useGetVarianceReport,
} from '@/src/lib/queries/reconciliation.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Calculator } from 'lucide-react';
import { toast } from 'sonner';

export default function ReconciliationPage() {
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [openingBalance, setOpeningBalance] = useState<string>('');
    const [closingBalance, setClosingBalance] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const { data: branches } = useGetBranches();
    const { data: reconciliations, isLoading } = useGetReconciliationHistory();
    const { data: varianceReport } = useGetVarianceReport();
    const createReconciliation = useCreateReconciliation();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedBranch || !openingBalance || !closingBalance) {
            toast.error('Please fill in all required fields');
            return;
        }

        createReconciliation.mutate(
            {
                branchId: Number(selectedBranch),
                date,
                openingBalance: parseFloat(openingBalance),
                closingBalance: parseFloat(closingBalance),
                notes: notes || undefined,
            },
            {
                onSuccess: (data) => {
                    const variance = data.variance || 0;
                    if (variance === 0) {
                        toast.success('✅ Reconciliation complete - balanced!');
                    } else {
                        toast.warning(`⚠️ Variance detected: ${variance.toFixed(2)}`);
                    }
                    // Reset form
                    setOpeningBalance('');
                    setClosingBalance('');
                    setNotes('');
                },
                onError: () => {
                    toast.error('Failed to create reconciliation');
                },
            }
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Daily Reconciliation</h1>
                <p className="text-gray-500 mt-1">Record opening and closing cash balances</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Input Form */}
                <Card className="border-2">
                    <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50">
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-cyan-600" />
                            Record Today's Count
                        </CardTitle>
                        <CardDescription>Enter your cash balances for verification</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Branch</Label>
                                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select branch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches?.map((branch: any) => (
                                            <SelectItem key={branch.id} value={String(branch.id)}>
                                                {branch.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="opening">Opening Balance</Label>
                                    <Input
                                        id="opening"
                                        type="number"
                                        step="0.01"
                                        value={openingBalance}
                                        onChange={(e) => setOpeningBalance(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="closing">Closing Balance</Label>
                                    <Input
                                        id="closing"
                                        type="number"
                                        step="0.01"
                                        value={closingBalance}
                                        onChange={(e) => setClosingBalance(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any discrepancies or notes..."
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={createReconciliation.isPending}>
                                {createReconciliation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Calculator className="h-4 w-4 mr-2" />
                                )}
                                Calculate & Submit
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Variance Alert */}
                <Card className="border-2">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            Variance Report
                        </CardTitle>
                        <CardDescription>Branches with cash discrepancies (Last 30 days)</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {varianceReport && varianceReport.length > 0 ? (
                            <div className="space-y-2">
                                {varianceReport.slice(0, 5).map((rec) => (
                                    <div
                                        key={rec.id}
                                        className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5 text-amber-600" />
                                            <div>
                                                <p className="font-medium text-sm">{rec.branch?.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(rec.date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-amber-700 border-amber-300 font-mono">
                                            {rec.variance > 0 ? '+' : ''}
                                            {rec.variance.toFixed(2)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                                <p className="text-sm font-medium text-gray-700">All branches balanced!</p>
                                <p className="text-xs text-gray-500">No discrepancies found</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* History Table */}
            <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold text-slate-800">Reconciliation History</CardTitle>
                            <CardDescription className="text-slate-500 mt-1">
                                Comprehensive record of all past reconciliations
                            </CardDescription>
                        </div>
                        <div className="hidden md:block">
                            <Badge variant="outline" className="bg-white text-slate-500 border-slate-200">
                                Last 10 Records
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
                            <p className="text-sm text-muted-foreground animate-pulse">Loading history...</p>
                        </div>
                    ) : reconciliations && reconciliations.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-b border-slate-100">
                                        <TableHead className="w-[140px] font-semibold text-slate-600 pl-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs uppercase tracking-wider">Date</span>
                                            </div>
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs uppercase tracking-wider">Branch</span>
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right font-semibold text-slate-600 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs uppercase tracking-wider">Opening</span>
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right font-semibold text-slate-600 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs uppercase tracking-wider">Closing</span>
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right font-semibold text-slate-600 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs uppercase tracking-wider">Expected</span>
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right font-semibold text-slate-600 pr-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs uppercase tracking-wider">Variance</span>
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reconciliations.slice(0, 10).map((rec, index) => (
                                        <TableRow
                                            key={rec.id}
                                            className={`
                                                group transition-colors hover:bg-slate-50/80 border-b border-slate-50
                                                ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}
                                            `}
                                        >
                                            <TableCell className="font-medium text-slate-700 pl-6 py-4">
                                                {new Date(rec.date).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">{rec.branch?.name}</span>
                                                    <span className="text-xs text-slate-400">ID: {rec.branch?.id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-slate-600 py-4">
                                                {rec.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-slate-600 py-4">
                                                {rec.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-slate-600 py-4">
                                                {rec.expectedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right pr-6 py-4">
                                                <Badge
                                                    variant={rec.variance === 0 ? 'outline' : 'destructive'}
                                                    className={`
                                                        px-3 py-1 font-mono text-xs tracking-wide
                                                        ${rec.variance === 0
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-sm'
                                                        }
                                                    `}
                                                >
                                                    {rec.variance > 0 ? '+' : ''}
                                                    {rec.variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/30">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <Calculator className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">No History Yet</h3>
                            <p className="text-sm text-slate-500 max-w-xs mt-1">
                                Complete your first daily reconciliation to see the history records here.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
