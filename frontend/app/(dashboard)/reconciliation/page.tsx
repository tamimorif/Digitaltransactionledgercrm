'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
  useCreateReconciliation,
  useGetReconciliationHistory,
  useGetSystemState,
} from '@/src/lib/queries/reconciliation.query';
import { useGetActiveCurrencies } from '@/src/lib/queries/cash-balance.query';
import { Calculator, CheckCircle2, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ReconciliationPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [currencyBreakdown, setCurrencyBreakdown] = useState<Record<string, string>>({});

  const branchId = selectedBranch ? Number(selectedBranch) : undefined;

  const { data: branches } = useGetBranches();
  const { data: reconciliations, isLoading: historyLoading } = useGetReconciliationHistory();
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

  const formatNumber = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
          Daily Reconciliation
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Ledger-style cash count with live system state verification.
        </p>
      </div>

      {/* Main Grid: 2fr (form) | 1fr (sidebar) */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] items-stretch">
        {/* ─────────────────────────────────────────────────────────────────────
            LEFT COLUMN: LEDGER FORM
        ───────────────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-6 py-5">
            <div className="flex items-center gap-2 text-base font-bold">
              <Calculator className="h-[18px] w-[18px] text-primary" />
              Reconciliation Ledger
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1: Branch + Date */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground">Branch</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select branch...</option>
                    {branches?.map((branch) => (
                      <option key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Row 2: Opening Balance + Closing Balance (Calculated) */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-muted-foreground">
                    Closing Balance (Actual)
                  </label>
                  <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                    {systemStateLoading ? 'Calculating...' : formatNumber(actualTotal)}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Currency
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Sys Cash
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Sys Bank
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Sys Total
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Actual (Count)
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Variance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemStateLoading ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                          <span className="mt-2 block text-sm">Loading system state...</span>
                        </td>
                      </tr>
                    ) : currencies.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          Select a branch to load currencies.
                        </td>
                      </tr>
                    ) : (
                      currencies.map((currency) => {
                        const expected = systemStateMap.get(currency);
                        const expectedCash = expected?.cash ?? 0;
                        const expectedBank = expected?.bank ?? 0;
                        const expectedTotalCurrency = expected?.total ?? 0;
                        const actualValue = parseFloat(currencyBreakdown[currency]) || 0;
                        const variance = actualValue - expectedTotalCurrency;
                        const isNeg = variance < -0.005;
                        const isPos = variance > 0.005;

                        return (
                          <tr key={currency} className="border-t border-border">
                            <td className="px-4 py-3 font-semibold">{currency}</td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatNumber(expectedCash)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatNumber(expectedBank)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatNumber(expectedTotalCurrency)}
                            </td>
                            <td className="w-[120px] px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={currencyBreakdown[currency] ?? ''}
                                onChange={(e) =>
                                  setCurrencyBreakdown((prev) => ({
                                    ...prev,
                                    [currency]: e.target.value,
                                  }))
                                }
                                className="h-8 w-full rounded border border-border bg-background px-2 text-right text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono font-semibold ${isNeg
                                ? 'text-destructive'
                                : isPos
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : ''
                                }`}
                            >
                              {isPos ? '+' : ''}
                              {formatNumber(variance)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-muted-foreground">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document any discrepancies or explanations here..."
                  className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={createReconciliation.isPending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {createReconciliation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Submit Reconciliation
              </button>
            </form>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            RIGHT COLUMN: SUMMARY + HISTORY
        ───────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 h-full">
          {/* System Summary Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              {isBalanced ? (
                <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
              ) : (
                <AlertTriangle className="h-[18px] w-[18px] text-amber-500" />
              )}
              <span className="text-base font-bold">System Summary</span>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-muted/60 pb-3">
                <span className="text-muted-foreground">Expected Total</span>
                <span className="font-semibold">{formatNumber(expectedTotal)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-muted/60 pb-3">
                <span className="text-muted-foreground">Actual Total</span>
                <span className="font-semibold">{formatNumber(actualTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Variance</span>
                <span
                  className={`font-semibold ${isBalanced
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-destructive'
                    }`}
                >
                  {varianceTotal > 0 ? '+' : ''}
                  {formatNumber(varianceTotal)}
                </span>
              </div>

              {/* Status Box */}
              <div
                className={`mt-4 rounded-lg border px-3 py-2.5 text-center text-[13px] font-semibold ${isBalanced
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
                  }`}
              >
                {isBalanced ? 'Balances Match — Ready to Submit' : 'Discrepancy Detected'}
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-base font-bold">History</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                Last 10
              </span>
            </div>
            <div className="flex-1 p-5 overflow-hidden flex flex-col">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="mt-2 text-sm">Loading...</span>
                </div>
              ) : reconciliations && reconciliations.length > 0 ? (
                <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                  {reconciliations.slice(0, 10).map((rec) => {
                    const hasVariance = Math.abs(rec.variance) > 0.005;
                    return (
                      <div
                        key={rec.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${hasVariance
                          ? 'border-amber-200/70 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10'
                          : 'border-border bg-muted/30'
                          }`}
                      >
                        <div>
                          <p className="font-medium">{rec.branch?.name ?? 'Branch'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(rec.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <span
                          className={`font-mono text-xs font-semibold ${hasVariance
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                          {rec.variance > 0 ? '+' : ''}
                          {formatNumber(rec.variance)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Clock className="mb-2 h-8 w-8" />
                  <p className="text-[13px] font-medium">No history yet</p>
                  <p className="text-xs">Complete your first reconciliation.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
