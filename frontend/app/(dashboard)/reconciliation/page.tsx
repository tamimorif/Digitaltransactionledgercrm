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
            <Card className="border-2">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
                    <CardTitle>Reconciliation History</CardTitle>
                    <CardDescription>Past reconciliation records</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Opening</TableHead>
                                    <TableHead>Closing</TableHead>
                                    <TableHead>Expected</TableHead>
                                    <TableHead>Variance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reconciliations?.slice(0, 10).map((rec) => (
                                    <TableRow key={rec.id} className="hover:bg-gray-50">
                                        <TableCell>{new Date(rec.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-medium">{rec.branch?.name}</TableCell>
                                        <TableCell className="font-mono">{rec.openingBalance.toFixed(2)}</TableCell>
                                        <TableCell className="font-mono">{rec.closingBalance.toFixed(2)}</TableCell>
                                        <TableCell className="font-mono">{rec.expectedBalance.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={rec.variance === 0 ? 'outline' : 'destructive'}
                                                className={rec.variance === 0 ? 'bg-green-100 text-green-700 border-green-300' : ''}
                                            >
                                                {rec.variance > 0 ? '+' : ''}
                                                {rec.variance.toFixed(2)}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
