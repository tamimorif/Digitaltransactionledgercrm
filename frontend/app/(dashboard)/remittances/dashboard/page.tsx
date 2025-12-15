'use client';

import { useState, useEffect } from 'react';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { OutgoingRemittance, IncomingRemittance, ProfitSummary } from '@/src/models/remittance';
import Link from 'next/link';

export default function RemittanceDashboard() {
    const [outgoing, setOutgoing] = useState<OutgoingRemittance[]>([]);
    const [incoming, setIncoming] = useState<IncomingRemittance[]>([]);
    const [profitSummary, setProfitSummary] = useState<ProfitSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load all data in parallel
            const [outgoingData, incomingData, summaryData] = await Promise.all([
                remittanceApi.getOutgoing(),
                remittanceApi.getIncoming(),
                remittanceApi.getProfitSummary(),
            ]);

            setOutgoing(outgoingData);
            setIncoming(incomingData);
            setProfitSummary(summaryData);
        } catch (err: any) {
            setError(err.message || 'Failed to load remittance data');
            console.error('Error loading remittance data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate statistics
    const pendingOutgoing = outgoing.filter(r => r.status === 'PENDING' || r.status === 'PARTIAL');
    const availableIncoming = incoming.filter(r => r.status === 'PENDING' || r.status === 'PARTIAL');

    const totalPendingDebt = pendingOutgoing.reduce((sum, r) => sum + r.remainingIrr, 0);
    const totalAvailableFunds = availableIncoming.reduce((sum, r) => sum + r.remainingIrr, 0);

    // Get recent activity (last 5 transactions)
    const recentActivity = [...outgoing, ...incoming]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading remittance data...</p>
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">💰 Remittance Dashboard</h1>
                    <p className="text-gray-600 mt-1">Hawala-style money transfer system</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/remittances/outgoing/create"
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                        📤 Create Outgoing
                    </Link>
                    <Link
                        href="/remittances/incoming/create"
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                        📥 Create Incoming
                    </Link>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Pending Debts */}
                <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                    <div className="text-sm text-gray-600 mb-1">Pending Debts</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {remittanceApi.formatCurrency(totalPendingDebt, 'IRR')}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        🔴 {pendingOutgoing.length} outgoing
                    </div>
                </div>

                {/* Available Funds */}
                <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                    <div className="text-sm text-gray-600 mb-1">Available Funds</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {remittanceApi.formatCurrency(totalAvailableFunds, 'IRR')}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        🟢 {availableIncoming.length} incoming
                    </div>
                </div>

                {/* Total Profit */}
                <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                    <div className="text-sm text-gray-600 mb-1">Total Profit</div>
                    <div className={`text-2xl font-bold ${profitSummary && profitSummary.totalProfitCAD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitSummary ? remittanceApi.formatCurrency(profitSummary.totalProfitCAD) : '$0.00'}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        {profitSummary?.totalSettlements || 0} settlements
                    </div>
                </div>

                {/* Average Profit */}
                <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                    <div className="text-sm text-gray-600 mb-1">Avg. Profit</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {profitSummary ? remittanceApi.formatCurrency(profitSummary.averageProfitCAD) : '$0.00'}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        per settlement
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">📊 Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/remittances/settle"
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg hover:from-blue-600 hover:to-blue-700 transition text-center"
                    >
                        <div className="text-3xl mb-2">🔗</div>
                        <div className="font-semibold">Quick Settle</div>
                        <div className="text-sm opacity-90">Match incoming with outgoing</div>
                    </Link>

                    <Link
                        href="/remittances/outgoing"
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 rounded-lg hover:from-red-600 hover:to-red-700 transition text-center"
                    >
                        <div className="text-3xl mb-2">📤</div>
                        <div className="font-semibold">View Outgoing</div>
                        <div className="text-sm opacity-90">All pending & completed</div>
                    </Link>

                    <Link
                        href="/remittances/incoming"
                        className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg hover:from-green-600 hover:to-green-700 transition text-center"
                    >
                        <div className="text-3xl mb-2">📥</div>
                        <div className="font-semibold">View Incoming</div>
                        <div className="text-sm opacity-90">All available funds</div>
                    </Link>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">📋 Recent Activity</h2>
                    <Link href="/remittances/reports" className="text-blue-600 hover:underline text-sm">
                        View Full Report →
                    </Link>
                </div>

                {recentActivity.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No remittances yet</p>
                        <p className="text-sm mt-2">Create your first remittance to get started</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentActivity.map((item) => {
                            const isOutgoing = 'buyRateCad' in item;
                            return (
                                <div
                                    key={`${isOutgoing ? 'out' : 'in'}-${item.id}`}
                                    className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`text-2xl ${isOutgoing ? 'text-red-500' : 'text-green-500'}`}>
                                            {isOutgoing ? '📤' : '📥'}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{item.remittanceCode}</div>
                                            <div className="text-sm text-gray-600">
                                                {isOutgoing ? item.recipientName : item.recipientName}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="font-semibold text-gray-900">
                                            {remittanceApi.formatCurrency(item.amountIrr, 'IRR')}
                                        </div>
                                        <div className="text-sm">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                    item.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                                        item.status === 'PENDING' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
