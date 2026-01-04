'use client';

import { useState, useMemo } from 'react';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
    useGetDailyReport,
    useGetMonthlyReport,
    useGetCustomReport,
} from '@/src/lib/queries/report.query';
import { useExportToCSV } from '@/src/lib/queries/statistics.query';
import { DollarSign, Activity, ShoppingCart, Building2, TrendingUp, Download } from 'lucide-react';
import { toast } from 'sonner';

type ReportMode = 'daily' | 'monthly' | 'custom';

export default function ReportsPage() {
    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [mode, setMode] = useState<ReportMode>('daily');
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');

    const { data: branches } = useGetBranches();
    const exportCSV = useExportToCSV();

    const branchId = selectedBranch !== 'all' ? Number(selectedBranch) : undefined;

    // Fetch report data based on mode
    const { data: dailyReport, isLoading: dailyLoading } = useGetDailyReport(
        mode === 'daily' ? selectedDate : undefined,
        mode === 'daily' ? branchId : undefined
    );
    const { data: monthlyReport, isLoading: monthlyLoading } = useGetMonthlyReport(
        mode === 'monthly' ? selectedYear : undefined,
        mode === 'monthly' ? selectedMonth : undefined,
        mode === 'monthly' ? branchId : undefined
    );
    const { data: customReport, isLoading: customLoading } = useGetCustomReport(
        mode === 'custom' ? startDate : undefined,
        mode === 'custom' ? endDate : undefined,
        mode === 'custom' ? branchId : undefined
    );

    // Get active report data
    const report = useMemo(() => {
        if (mode === 'daily') return dailyReport;
        if (mode === 'monthly') return monthlyReport;
        return customReport;
    }, [mode, dailyReport, monthlyReport, customReport]);

    const isLoading = dailyLoading || monthlyLoading || customLoading;

    // Calculate avg profit per transaction
    const avgProfitPerTxn = useMemo(() => {
        if (!report || report.totalTransactions === 0) return 0;
        return report.totalRevenue / report.totalTransactions;
    }, [report]);

    const handleExportCSV = () => {
        const filters = {
            startDate: mode === 'daily' ? selectedDate : mode === 'custom' ? startDate : undefined,
            endDate: mode === 'daily' ? selectedDate : mode === 'custom' ? endDate : undefined,
            branchId: branchId,
        };

        exportCSV.mutate(filters, {
            onSuccess: () => toast.success('Report exported successfully'),
            onError: () => toast.error('Failed to export report'),
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('en-US').format(value);
    };

    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Profit Report</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Overview of fees collected and net margins across branches.
                </p>
            </div>

            {/* Controls Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-4 items-center shadow-sm">
                {/* Segmented Control */}
                <div className="bg-slate-100 p-1 rounded-lg flex">
                    <button
                        onClick={() => setMode('daily')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${mode === 'daily'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Daily
                    </button>
                    <button
                        onClick={() => setMode('monthly')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${mode === 'monthly'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setMode('custom')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${mode === 'custom'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Custom
                    </button>
                </div>

                {/* Date Inputs based on mode */}
                {mode === 'daily' && (
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                )}

                {mode === 'monthly' && (
                    <div className="flex gap-2">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Array.from({ length: 5 }, (_, i) => (
                                <option key={i} value={currentYear - i}>
                                    {currentYear - i}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {mode === 'custom' && (
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Start"
                        />
                        <span className="text-slate-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="End"
                        />
                    </div>
                )}

                {/* Branch Selector */}
                <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
                >
                    <option value="all">All Branches</option>
                    {branches?.map((branch) => (
                        <option key={branch.id} value={String(branch.id)}>
                            {branch.name}
                        </option>
                    ))}
                </select>

                {/* Export Button */}
                <button
                    onClick={handleExportCSV}
                    disabled={exportCSV.isPending}
                    className="ml-auto bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    {exportCSV.isPending ? 'Exporting...' : 'Export CSV'}
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Revenue */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Revenue
                        </span>
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900">
                        {isLoading ? '...' : formatCurrency(report?.totalRevenue || 0)}
                    </div>
                    <div className="text-xs font-semibold text-emerald-500 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        From fees collected
                    </div>
                </div>

                {/* Transactions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Transactions
                        </span>
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <Activity className="w-5 h-5 text-emerald-500" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900">
                        {isLoading ? '...' : formatNumber(report?.totalTransactions || 0)}
                    </div>
                    <div className="text-xs font-semibold text-emerald-500 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Completed transactions
                    </div>
                </div>

                {/* Avg Profit / Txn */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Avg. Profit / Txn
                        </span>
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-slate-500" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900">
                        {isLoading ? '...' : formatCurrency(avgProfitPerTxn)}
                    </div>
                    <div className="text-xs font-medium text-slate-400 mt-2">
                        Revenue per transaction
                    </div>
                </div>
            </div>

            {/* Branch Performance Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-base font-bold text-slate-900">Branch Performance Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left px-6 py-3.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                                    Branch Name
                                </th>
                                <th className="text-right px-6 py-3.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                                    Transaction Count
                                </th>
                                <th className="text-right px-6 py-3.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                                    Volume (USD)
                                </th>
                                <th className="text-right px-6 py-3.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                                    Fees Collected
                                </th>
                                <th className="text-right px-6 py-3.5 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                                    Net Profit
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        Loading report data...
                                    </td>
                                </tr>
                            ) : !report?.branchPerformance?.length ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        No data available for this period.
                                    </td>
                                </tr>
                            ) : (
                                report.branchPerformance.map((branch) => (
                                    <tr key={branch.branchId} className="border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                                    <Building2 className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <span className="font-semibold text-slate-900">
                                                    {branch.branchName || 'Unknown Branch'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-900">
                                            {formatNumber(branch.txCount)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-900">
                                            {formatCurrency(branch.volume || 0)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-900">
                                            {formatCurrency(branch.revenue)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">
                                                {formatCurrency(branch.revenue)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
