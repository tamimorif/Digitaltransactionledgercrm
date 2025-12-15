'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Skeleton } from '@/src/components/ui/skeleton';
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
import { toast } from 'sonner';
import {
    useGetSettlementSuggestions,
    useAutoSettle,
    useExecuteSettlement,
    useGetUnsettledSummary,
} from '@/src/lib/queries/dashboard.query';
import { SettlementSuggestion } from '@/src/lib/models/dashboard.model';
import { formatNumber, formatCurrency } from '@/src/lib/format';
import { cn } from '@/src/lib/utils';
import {
    ArrowLeftRight,
    Zap,
    Loader2,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    Info,
} from 'lucide-react';

interface AutoSettlementPanelProps {
    incomingId: number;
    incomingCode: string;
    incomingAmount: number;
    remainingAmount: number;
    onSettlementComplete?: () => void;
}

export function AutoSettlementPanel({
    incomingId,
    incomingCode,
    incomingAmount,
    remainingAmount,
    onSettlementComplete,
}: AutoSettlementPanelProps) {
    const [selectedSuggestion, setSelectedSuggestion] = useState<SettlementSuggestion | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const { data: suggestions, isLoading, refetch } = useGetSettlementSuggestions(incomingId);
    const autoSettleMutation = useAutoSettle();
    const executeSettlementMutation = useExecuteSettlement();

    const handleAutoSettle = async () => {
        try {
            const result = await autoSettleMutation.mutateAsync(incomingId);
            toast.success(
                `Auto-settled ${result.settledCount} remittances. Total profit: ${formatCurrency(result.totalProfitCAD, 'CAD')}`
            );
            refetch();
            onSettlementComplete?.();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Auto-settlement failed');
        }
    };

    const handleExecuteSettlement = async () => {
        if (!selectedSuggestion) return;

        const amount = customAmount
            ? parseFloat(customAmount)
            : selectedSuggestion.suggestedAmount;

        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (amount > selectedSuggestion.remainingAmount) {
            toast.error('Amount exceeds remaining debt');
            return;
        }

        if (amount > remainingAmount) {
            toast.error('Amount exceeds incoming remaining');
            return;
        }

        try {
            const result = await executeSettlementMutation.mutateAsync({
                outgoingId: selectedSuggestion.outgoingId,
                incomingId,
                amount,
            });
            toast.success(`Settlement completed. Profit: ${formatCurrency(result.profit, 'CAD')}`);
            setShowConfirmDialog(false);
            setSelectedSuggestion(null);
            setCustomAmount('');
            refetch();
            onSettlementComplete?.();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Settlement failed');
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Settlement Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5" />
                            Settlement Suggestions
                        </CardTitle>
                        <CardDescription>
                            For incoming {incomingCode} • {formatNumber(remainingAmount)} IRR remaining
                        </CardDescription>
                    </div>
                    <Button
                        onClick={handleAutoSettle}
                        disabled={autoSettleMutation.isPending || !suggestions?.length}
                    >
                        {autoSettleMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Zap className="h-4 w-4 mr-2" />
                        )}
                        Auto-Settle All
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {!suggestions || suggestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Info className="h-8 w-8 mx-auto mb-2" />
                        <p>No matching outgoing remittances found</p>
                        <p className="text-sm">All outgoing remittances may already be settled</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Outgoing</TableHead>
                                <TableHead>Sender</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead className="text-right">Suggested</TableHead>
                                <TableHead className="text-right">Est. Profit</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suggestions.map((suggestion) => (
                                <TableRow key={suggestion.outgoingId}>
                                    <TableCell>
                                        <div>
                                            <span className="font-mono text-sm">
                                                {suggestion.outgoingCode}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="ml-2 text-xs"
                                            >
                                                #{suggestion.priority}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>{suggestion.senderName}</TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(suggestion.remainingAmount)} IRR
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatNumber(suggestion.suggestedAmount)} IRR
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span
                                            className={cn(
                                                'font-medium',
                                                suggestion.estimatedProfit >= 0
                                                    ? 'text-green-600'
                                                    : 'text-red-600'
                                            )}
                                        >
                                            {suggestion.estimatedProfit >= 0 ? (
                                                <TrendingUp className="h-3 w-3 inline mr-1" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3 inline mr-1" />
                                            )}
                                            {formatCurrency(Math.abs(suggestion.estimatedProfit), 'CAD')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedSuggestion(suggestion);
                                                setCustomAmount(suggestion.suggestedAmount.toString());
                                                setShowConfirmDialog(true);
                                            }}
                                        >
                                            Settle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            {/* Settlement Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Settlement</DialogTitle>
                        <DialogDescription>
                            Settle incoming {incomingCode} with outgoing{' '}
                            {selectedSuggestion?.outgoingCode}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSuggestion && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                                <div>
                                    <span className="text-sm text-muted-foreground">Buy Rate</span>
                                    <p className="font-medium">
                                        {formatNumber(selectedSuggestion.buyRate)} IRR/CAD
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">Sell Rate</span>
                                    <p className="font-medium">
                                        {formatNumber(selectedSuggestion.sellRate)} IRR/CAD
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">
                                        Outgoing Remaining
                                    </span>
                                    <p className="font-medium">
                                        {formatNumber(selectedSuggestion.remainingAmount)} IRR
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">
                                        Incoming Remaining
                                    </span>
                                    <p className="font-medium">{formatNumber(remainingAmount)} IRR</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount">Settlement Amount (IRR)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    placeholder="Enter amount"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Max: {formatNumber(Math.min(selectedSuggestion.remainingAmount, remainingAmount))} IRR
                                </p>
                            </div>

                            <div className="p-4 bg-muted rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">Estimated Profit</span>
                                    <span
                                        className={cn(
                                            'text-lg font-bold',
                                            selectedSuggestion.estimatedProfit >= 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                        )}
                                    >
                                        {selectedSuggestion.estimatedProfit >= 0 ? '+' : ''}
                                        {formatCurrency(selectedSuggestion.estimatedProfit, 'CAD')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowConfirmDialog(false);
                                setSelectedSuggestion(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleExecuteSettlement}
                            disabled={executeSettlementMutation.isPending}
                        >
                            {executeSettlementMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Confirm Settlement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// Unsettled Summary Widget
export function UnsettledSummaryWidget() {
    const { data: summary, isLoading } = useGetUnsettledSummary();

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!summary) return null;

    const netPosition = summary.netPositionIRR;
    const isPositive = netPosition >= 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Unsettled Position</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Outgoing</span>
                        <div className="text-right">
                            <span className="font-medium">{summary.totalOutgoings}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                                ({formatNumber(summary.outgoingAmountIRR)} IRR)
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Incoming</span>
                        <div className="text-right">
                            <span className="font-medium">{summary.totalIncomings}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                                ({formatNumber(summary.incomingAmountIRR)} IRR)
                            </span>
                        </div>
                    </div>
                    <div className="border-t pt-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Net Position</span>
                            <span
                                className={cn(
                                    'font-bold',
                                    isPositive ? 'text-green-600' : 'text-red-600'
                                )}
                            >
                                {isPositive ? '+' : ''}
                                {formatNumber(netPosition)} IRR
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isPositive
                                ? 'More outgoing than incoming (owe to Iran)'
                                : 'More incoming than outgoing (Iran owes you)'}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
