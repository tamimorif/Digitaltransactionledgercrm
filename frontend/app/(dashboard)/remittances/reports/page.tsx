'use client';

import { useState, useEffect, useCallback } from 'react';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { OutgoingRemittance, IncomingRemittance, ProfitSummary } from '@/src/models/remittance';
import Link from 'next/link';
import { getErrorMessage } from '@/src/lib/error';

export default function RemittanceReports() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [profitSummary, setProfitSummary] = useState<ProfitSummary | null>(null);
    const [outgoing, setOutgoing] = useState<OutgoingRemittance[]>([]);
    const [incoming, setIncoming] = useState<IncomingRemittance[]>([]);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        // Set default date range (last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    }, []);

    const loadData = useCallback(async () => {
        if (!startDate || !endDate) return;
        try {
            setLoading(true);
            setError(null);

            const [summaryData, outgoingData, incomingData] = await Promise.all([
                remittanceApi.getProfitSummary(startDate, endDate),
                remittanceApi.getOutgoing(),
                remittanceApi.getIncoming(),
            ]);

            setProfitSummary(summaryData);
            setOutgoing(outgoingData);
            setIncoming(incomingData);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load report data'));
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Calculate additional metrics
    const calculateMetrics = () => {
        const totalOutgoing = outgoing.reduce((sum, r) => sum + r.amountIrr, 0);
        const totalIncoming = incoming.reduce((sum, r) => sum + r.amountIrr, 0);
        const totalSettled = outgoing.reduce((sum, r) => sum + r.settledAmountIrr, 0);
        const totalAllocated = incoming.reduce((sum, r) => sum + r.allocatedIrr, 0);
        const totalProfit = outgoing.reduce((sum, r) => sum + r.totalProfitCad, 0);

        const profitableCount = outgoing.filter(r => r.totalProfitCad > 0).length;
        const lossCount = outgoing.filter(r => r.totalProfitCad < 0).length;

        return {
            totalOutgoing,
            totalIncoming,
            totalSettled,
            totalAllocated,
            totalProfit,
            profitableCount,
            lossCount,
        };
    };

    const metrics = calculateMetrics();

    // Get top profitable settlements
    const getTopProfitable = () => {
        return [...outgoing]
            .filter(r => r.totalProfitCad > 0)
            .sort((a, b) => b.totalProfitCad - a.totalProfitCad)
            .slice(0, 10);
    };

    // Get loss-making settlements
    const getLossMaking = () => {
        return [...outgoing]
            .filter(r => r.totalProfitCad < 0)
            .sort((a, b) => a.totalProfitCad - b.totalProfitCad)
            .slice(0, 10);
    };

    const topProfitable = getTopProfitable();
    const lossMaking = getLossMaking();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading report data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                    <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={loadData}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">📊 Profit & Loss Report</h1>
                <p className="text-gray-600 mt-1">Analyze remittance performance and profitability</p>
            </div>

            {/* Date Range Filter */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">📅 Date Range</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={loadData}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            Update Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow p-6">
                    <div className="text-sm opacity-90 mb-1">Total Profit</div>
                    <div className="text-3xl font-bold">
                        {remittanceApi.formatCurrency(metrics.totalProfit)}
                    </div>
                    <div className="text-sm opacity-90 mt-2">
                        {profitSummary?.totalSettlements || 0} settlements
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow p-6">
                    <div className="text-sm opacity-90 mb-1">Average Profit</div>
                    <div className="text-3xl font-bold">
                        {remittanceApi.formatCurrency(profitSummary?.averageProfitCAD || 0)}
                    </div>
                    <div className="text-sm opacity-90 mt-2">per settlement</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow p-6">
                    <div className="text-sm opacity-90 mb-1">Profitable</div>
                    <div className="text-3xl font-bold">{metrics.profitableCount}</div>
                    <div className="text-sm opacity-90 mt-2">
                        {outgoing.length > 0 ? ((metrics.profitableCount / outgoing.length) * 100).toFixed(0) : 0}% of total
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow p-6">
                    <div className="text-sm opacity-90 mb-1">Loss Making</div>
                    <div className="text-3xl font-bold">{metrics.lossCount}</div>
                    <div className="text-sm opacity-90 mt-2">
                        {outgoing.length > 0 ? ((metrics.lossCount / outgoing.length) * 100).toFixed(0) : 0}% of total
                    </div>
                </div>
            </div>

            {/* Volume Metrics */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">💹 Volume Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Total Outgoing</div>
                        <div className="text-xl font-bold text-gray-900">
                            {remittanceApi.formatCurrency(metrics.totalOutgoing, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-500">{outgoing.length} transactions</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Total Incoming</div>
                        <div className="text-xl font-bold text-gray-900">
                            {remittanceApi.formatCurrency(metrics.totalIncoming, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-500">{incoming.length} transactions</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Total Settled</div>
                        <div className="text-xl font-bold text-green-600">
                            {remittanceApi.formatCurrency(metrics.totalSettled, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-500">
                            {metrics.totalOutgoing > 0 ? ((metrics.totalSettled / metrics.totalOutgoing) * 100).toFixed(0) : 0}% of outgoing
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Total Allocated</div>
                        <div className="text-xl font-bold text-blue-600">
                            {remittanceApi.formatCurrency(metrics.totalAllocated, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-500">
                            {metrics.totalIncoming > 0 ? ((metrics.totalAllocated / metrics.totalIncoming) * 100).toFixed(0) : 0}% of incoming
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Profitable Settlements */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">🏆 Top Profitable Settlements</h3>
                {topProfitable.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No profitable settlements yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Settled</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {topProfitable.map((remittance) => (
                                    <tr key={remittance.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {remittance.remittanceCode}
                                        </td>
                                        <td className="px-6 py-4">{remittance.recipientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {remittanceApi.formatCurrency(remittance.amountIrr, 'IRR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {remittanceApi.getSettlementPercentage(remittance).toFixed(0)}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-green-600 font-bold">
                                                +{remittanceApi.formatCurrency(remittance.totalProfitCad)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/remittances/outgoing/${remittance.id}`}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Loss-Making Settlements */}
            {lossMaking.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">⚠️ Loss-Making Settlements</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Settled</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loss</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {lossMaking.map((remittance) => (
                                    <tr key={remittance.id} className="hover:bg-gray-50 bg-red-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {remittance.remittanceCode}
                                        </td>
                                        <td className="px-6 py-4">{remittance.recipientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {remittanceApi.formatCurrency(remittance.amountIrr, 'IRR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {remittanceApi.getSettlementPercentage(remittance).toFixed(0)}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-red-600 font-bold">
                                                {remittanceApi.formatCurrency(remittance.totalProfitCad)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/remittances/outgoing/${remittance.id}`}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Status Summary */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">📈 Status Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                            {outgoing.filter(r => r.status === 'PENDING').length}
                        </div>
                        <div className="text-sm text-gray-600">Pending</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">
                            {outgoing.filter(r => r.status === 'PARTIAL').length}
                        </div>
                        <div className="text-sm text-gray-600">Partial</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                            {outgoing.filter(r => r.status === 'COMPLETED').length}
                        </div>
                        <div className="text-sm text-gray-600">Completed</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">
                            {outgoing.filter(r => r.status === 'CANCELLED').length}
                        </div>
                        <div className="text-sm text-gray-600">Cancelled</div>
                    </div>
                </div>
            </div>

            {/* Export Note */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <div className="text-2xl">💡</div>
                    <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Export Functionality</h4>
                        <p className="text-sm text-blue-800">
                            To export this data, you can use your browser&apos;s print function (Ctrl+P / Cmd+P) and save as PDF.
                            For Excel export, consider installing a reporting library like <code className="bg-blue-100 px-1 rounded">xlsx</code>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
