'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
  useCreateReconciliation,
  useGetReconciliationHistory,
  useGetSystemState,
  useGetVarianceReport,
} from '@/src/lib/queries/reconciliation.query';
import { useGetActiveCurrencies } from '@/src/lib/queries/cash-balance.query';
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
import { AlertCircle, CheckCircle2, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReconciliationPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [currencyBreakdown, setCurrencyBreakdown] = useState<Record<string, string>>({});

  const branchId = selectedBranch ? Number(selectedBranch) : undefined;

  const { data: branches } = useGetBranches();
  const { data: reconciliations, isLoading } = useGetReconciliationHistory();
  const { data: varianceReport } = useGetVarianceReport();
  const { data: systemState, isLoading: systemStateLoading } = useGetSystemState(branchId);
  const { data: activeCurrencies } = useGetActiveCurrencies(branchId);
  const createReconciliation = useCreateReconciliation();

  const currencies = useMemo(() => {
    if (systemState && systemState.length > 0) {
      return systemState.map((item) => item.currency);
    }
    return activeCurrencies ?? [];
  }, [systemState, activeCurrencies]);

  useEffect(() => {
    if (!currencies.length) return;
    setCurrencyBreakdown((prev) => {
      const next: Record<string, string> = { ...prev };
      currencies.forEach((currency) => {
        if (next[currency] === undefined) {
          next[currency] = '';
        }
      });
      Object.keys(next).forEach((currency) => {
        if (!currencies.includes(currency)) {
          delete next[currency];
        }
      });
      return next;
    });
  }, [currencies]);

  const systemStateMap = useMemo(() => {
    const map = new Map<string, { cash: number; bank: number; total: number }>();
    systemState?.forEach((entry) => {
      map.set(entry.currency, {
        cash: entry.cash ?? 0,
        bank: entry.bank ?? 0,
        total: entry.total ?? 0,
      });
    });
    return map;
  }, [systemState]);

  const actualTotal = Object.values(currencyBreakdown).reduce(
    (sum, value) => sum + (parseFloat(value) || 0),
    0
  );
  const expectedTotal = (systemState ?? []).reduce((sum, entry) => sum + (entry.total ?? 0), 0);
  const varianceTotal = actualTotal - expectedTotal;
  const isBalanced = Math.abs(varianceTotal) < 0.01;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBranch || openingBalance.trim() === '') {
      toast.error('Please fill in all required fields');
      return;
    }

    const breakdownPayload = Object.fromEntries(
      Object.entries(currencyBreakdown).map(([currency, value]) => [currency, parseFloat(value) || 0])
    );

    createReconciliation.mutate(
      {
        branchId: Number(selectedBranch),
        date,
        openingBalance: parseFloat(openingBalance) || 0,
        closingBalance: actualTotal,
        currencyBreakdown: breakdownPayload,
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
          setOpeningBalance('');
          setNotes('');
          setCurrencyBreakdown({});
        },
        onError: () => {
          toast.error('Failed to create reconciliation');
        },
      }
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-6 font-[Inter]">
      <div>
        <h1 className="text-3xl font-bold">Daily Reconciliation</h1>
        <p className="text-muted-foreground mt-1">Ledger-style cash count with live system state</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Ledger Sheet */}
        <Card className="border-border/60">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Reconciliation Ledger
                </CardTitle>
                <CardDescription>Compare expected vs actual balances by currency</CardDescription>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map((branch) => (
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
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
                <Label>Closing Balance (Actual)</Label>
                <div className="h-10 rounded-md border border-border bg-muted/40 px-3 flex items-center text-sm font-semibold">
                  {actualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Currency</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">System Cash</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">System Bank</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">System Total</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Actual</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {systemStateLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading system state...
                      </TableCell>
                    </TableRow>
                  ) : currencies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Select a branch to load currencies.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currencies.map((currency, index) => {
                      const expected = systemStateMap.get(currency);
                      const expectedCash = expected?.cash ?? 0;
                      const expectedBank = expected?.bank ?? 0;
                      const expectedTotalCurrency = expected?.total ?? 0;
                      const actualValue = parseFloat(currencyBreakdown[currency]) || 0;
                      const variance = actualValue - expectedTotalCurrency;

                      return (
                        <TableRow
                          key={currency}
                          className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                        >
                          <TableCell className="py-2 text-xs font-medium">{currency}</TableCell>
                          <TableCell className="py-2 text-right text-xs font-mono">
                            {expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="py-2 text-right text-xs font-mono">
                            {expectedBank.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="py-2 text-right text-xs font-mono">
                            {expectedTotalCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-right text-xs"
                              value={currencyBreakdown[currency] ?? ''}
                              onChange={(e) =>
                                setCurrencyBreakdown((prev) => ({
                                  ...prev,
                                  [currency]: e.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Badge
                              variant={Math.abs(variance) < 0.01 ? 'outline' : 'destructive'}
                              className={
                                Math.abs(variance) < 0.01
                                  ? 'rounded-full border-emerald-200 px-2 text-[11px] text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-400'
                                  : 'rounded-full border-rose-200 px-2 text-[11px] text-rose-600 dark:border-rose-500/30 dark:text-rose-400'
                              }
                            >
                              {variance > 0 ? '+' : ''}
                              {variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {currencies.length > 0 && !systemStateLoading && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell className="py-2 text-xs">Total</TableCell>
                      <TableCell className="py-2 text-right text-xs">—</TableCell>
                      <TableCell className="py-2 text-right text-xs">—</TableCell>
                      <TableCell className="py-2 text-right text-xs">
                        {expectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs">
                        {actualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs">
                        <Badge
                          variant={isBalanced ? 'outline' : 'destructive'}
                          className={
                            isBalanced
                              ? 'rounded-full border-emerald-200 px-2 text-[11px] text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-400'
                              : 'rounded-full border-rose-200 px-2 text-[11px] text-rose-600 dark:border-rose-500/30 dark:text-rose-400'
                          }
                        >
                          {varianceTotal > 0 ? '+' : ''}
                          {varianceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document any discrepancies or explanations..."
              />
            </div>

            <Button type="submit" className="w-full" disabled={createReconciliation.isPending}>
              {createReconciliation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Submit Reconciliation
            </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sticky Summary */}
        <div className="space-y-6">
          <Card className="border-border/60 sticky top-24">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                {isBalanced ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                System Summary
              </CardTitle>
              <CardDescription className="text-xs">Expected vs actual totals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expected Total</span>
                <span className="font-semibold">
                  {expectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actual Total</span>
                <span className="font-semibold">
                  {actualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Variance</span>
                <span className={isBalanced ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                  {varianceTotal > 0 ? '+' : ''}
                  {varianceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`rounded-lg px-3 py-2 text-xs font-medium ${isBalanced ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                {isBalanced ? 'Balances match. Ready to submit.' : 'Variance detected. Double-check counts.'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Variance Report
              </CardTitle>
              <CardDescription className="text-xs">Branches with cash discrepancies (Last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              {varianceReport && varianceReport.length > 0 ? (
                <div className="space-y-2">
                  {varianceReport.slice(0, 5).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10"
                    >
                      <div>
                        <p className="text-xs font-medium">{rec.branch?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(rec.date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-amber-300 text-[11px] font-mono text-amber-700 dark:border-amber-500/40 dark:text-amber-400">
                        {rec.variance > 0 ? '+' : ''}
                        {rec.variance.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium">All branches balanced!</p>
                  <p className="text-xs text-muted-foreground">No discrepancies found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Table */}
      <Card className="border-border/60">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Reconciliation History</CardTitle>
              <CardDescription>Comprehensive record of past reconciliations</CardDescription>
            </div>
            <Badge variant="outline" className="hidden md:inline-flex">
              Last 10 Records
            </Badge>
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
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[140px] text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Branch</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Opening</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Closing</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Expected</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.slice(0, 10).map((rec, index) => (
                    <TableRow
                      key={rec.id}
                      className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                    >
                      <TableCell className="py-2 text-xs font-medium">
                        {new Date(rec.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium">{rec.branch?.name}</span>
                          <span className="text-xs text-muted-foreground">ID: {rec.branch?.id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono">
                        {rec.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono">
                        {rec.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono">
                        {rec.expectedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs">
                        <Badge
                          variant={rec.variance === 0 ? 'outline' : 'destructive'}
                          className={
                            rec.variance === 0
                              ? 'rounded-full border-emerald-200 px-2 text-[11px] text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400'
                              : 'rounded-full border-rose-200 px-2 text-[11px] text-rose-700 dark:border-rose-500/30 dark:text-rose-400'
                          }
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted/50 p-4 rounded-full mb-4">
                <Calculator className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No History Yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Complete your first daily reconciliation to see the history records here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
