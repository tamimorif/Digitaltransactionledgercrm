'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { OutgoingRemittance } from '@/src/models/remittance';
import Link from 'next/link';

export default function OutgoingRemittanceDetails() {
    const router = useRouter();
    const params = useParams();
    const id = parseInt(params.id as string);

    const [remittance, setRemittance] = useState<OutgoingRemittance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadRemittance();
        }
    }, [id]);

    const loadRemittance = async () => {
        try {
            setLoading(true);
            const data = await remittanceApi.getOutgoingDetails(id);
            setRemittance(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load remittance details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading details...</p>
                </div>
            </div>
        );
    }

    if (error || !remittance) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                    <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                    <p className="text-red-600">{error || 'Remittance not found'}</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-red-100 text-red-800';
            case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
            case 'COMPLETED': return 'bg-green-100 text-green-800';
            case 'CANCELLED': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const progress = remittanceApi.getSettlementPercentage(remittance);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <button
                        onClick={() => router.back()}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        ← Back
                    </button>
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">📤 {remittance.remittanceCode}</h1>
                        <p className="text-gray-600 mt-1">Outgoing Remittance Details</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(remittance.status)}`}>
                        {remittance.status}
                    </span>
                </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sender */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">👤 Sender (Canada)</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Name:</span>
                                <span className="font-medium">{remittance.senderName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Phone:</span>
                                <span className="font-medium">{remittance.senderPhone}</span>
                            </div>
                            {remittance.senderEmail && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="font-medium">{remittance.senderEmail}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recipient */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">👥 Recipient (Iran)</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Name:</span>
                                <span className="font-medium" dir="rtl">{remittance.recipientName}</span>
                            </div>
                            {remittance.recipientPhone && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Phone:</span>
                                    <span className="font-medium">{remittance.recipientPhone}</span>
                                </div>
                            )}
                            {remittance.recipientIban && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">IBAN:</span>
                                    <span className="font-medium font-mono text-xs">{remittance.recipientIban}</span>
                                </div>
                            )}
                            {remittance.recipientBank && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Bank:</span>
                                    <span className="font-medium" dir="rtl">{remittance.recipientBank}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">💰 Financial Summary</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Total Amount</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {remittanceApi.formatCurrency(remittance.amountIrr, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {remittanceApi.formatCurrency(remittance.equivalentCad)} CAD
                        </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Settled</div>
                        <div className="text-2xl font-bold text-green-600">
                            {remittanceApi.formatCurrency(remittance.settledAmountIrr, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{progress.toFixed(0)}% complete</div>
                    </div>

                    <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Remaining Debt</div>
                        <div className="text-2xl font-bold text-red-600">
                            {remittanceApi.formatCurrency(remittance.remainingIrr, 'IRR')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {remittanceApi.formatCurrency(remittance.remainingIrr / remittance.buyRateCad)} CAD
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Settlement Progress</span>
                        <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${progress === 100 ? 'bg-green-600' : progress > 0 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
                    <div>
                        <div className="text-gray-600">Buy Rate</div>
                        <div className="font-semibold">{remittance.buyRateCad.toLocaleString()} T/CAD</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Received</div>
                        <div className="font-semibold">{remittanceApi.formatCurrency(remittance.receivedCad)}</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Fee</div>
                        <div className="font-semibold">{remittanceApi.formatCurrency(remittance.feeCAD)}</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Total Profit</div>
                        <div className={`font-semibold ${remittance.totalProfitCad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {remittance.totalProfitCad >= 0 ? '+' : ''}{remittanceApi.formatCurrency(remittance.totalProfitCad)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Settlement History */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">📜 Settlement History</h3>

                {!remittance.settlements || remittance.settlements.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No settlements yet</p>
                        <Link
                            href="/remittances/settle"
                            className="inline-block mt-4 text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Go to Settlement Page →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {remittance.settlements.map((settlement, index) => (
                            <div key={settlement.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            Settlement #{index + 1}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {new Date(settlement.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold ${settlement.profitCad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {settlement.profitCad >= 0 ? '+' : ''}{remittanceApi.formatCurrency(settlement.profitCad)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <div className="text-gray-600">Amount Settled</div>
                                        <div className="font-medium">{remittanceApi.formatCurrency(settlement.settledAmountIrr, 'IRR')}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600">Buy Rate</div>
                                        <div className="font-medium">{settlement.outgoingBuyRate.toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600">Sell Rate</div>
                                        <div className="font-medium">{settlement.incomingSellRate.toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600">Incoming Code</div>
                                        <div className="font-medium">
                                            {settlement.incomingRemittance?.remittanceCode || `IN-${settlement.incomingRemittanceId}`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notes */}
            {remittance.notes && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">📝 Notes</h3>
                    <p className="text-gray-700">{remittance.notes}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button
                    onClick={() => router.push('/remittances/outgoing')}
                    className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                    Back to List
                </button>
                {remittance.status !== 'COMPLETED' && remittance.status !== 'CANCELLED' && (
                    <Link
                        href="/remittances/settle"
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium text-center"
                    >
                        Settle More
                    </Link>
                )}
            </div>
        </div>
    );
}
