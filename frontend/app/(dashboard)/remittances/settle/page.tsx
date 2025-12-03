'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { OutgoingRemittance, IncomingRemittance } from '@/src/models/remittance';

export default function SettlementInterface() {
    const router = useRouter();
    const [outgoing, setOutgoing] = useState<OutgoingRemittance[]>([]);
    const [incoming, setIncoming] = useState<IncomingRemittance[]>([]);
    const [selectedOutgoing, setSelectedOutgoing] = useState<OutgoingRemittance | null>(null);
    const [selectedIncoming, setSelectedIncoming] = useState<IncomingRemittance | null>(null);
    const [settlementAmount, setSettlementAmount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [settling, setSettling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [outgoingData, incomingData] = await Promise.all([
                remittanceApi.getOutgoing({ status: 'PENDING,PARTIAL' }),
                remittanceApi.getIncoming({ status: 'PENDING,PARTIAL' }),
            ]);
            setOutgoing(outgoingData);
            setIncoming(incomingData);
        } catch (err: any) {
            setError(err.message || 'Failed to load remittances');
        } finally {
            setLoading(false);
        }
    };

    // Calculate max settlement amount
    const getMaxSettlementAmount = () => {
        if (!selectedOutgoing || !selectedIncoming) return 0;
        return Math.min(selectedOutgoing.remainingIrr, selectedIncoming.remainingIrr);
    };

    // Calculate profit preview
    const getProfitPreview = () => {
        if (!selectedOutgoing || !selectedIncoming || settlementAmount === 0) {
            return { costCad: 0, revenueCad: 0, profitCad: 0, profitMargin: 0 };
        }
        return remittanceApi.calculateProfitPreview(selectedOutgoing, selectedIncoming, settlementAmount);
    };

    const profitPreview = getProfitPreview();

    const handleSelectOutgoing = (item: OutgoingRemittance) => {
        setSelectedOutgoing(item);
        // Auto-suggest settlement amount
        if (selectedIncoming) {
            const max = Math.min(item.remainingIrr, selectedIncoming.remainingIrr);
            setSettlementAmount(max);
        } else {
            setSettlementAmount(item.remainingIrr);
        }
    };

    const handleSelectIncoming = (item: IncomingRemittance) => {
        setSelectedIncoming(item);
        // Auto-suggest settlement amount
        if (selectedOutgoing) {
            const max = Math.min(selectedOutgoing.remainingIrr, item.remainingIrr);
            setSettlementAmount(max);
        } else {
            setSettlementAmount(item.remainingIrr);
        }
    };

    const handleSettle = async () => {
        if (!selectedOutgoing || !selectedIncoming) {
            setError('Please select both outgoing and incoming remittances');
            return;
        }

        if (settlementAmount <= 0) {
            setError('Settlement amount must be greater than 0');
            return;
        }

        if (settlementAmount > selectedOutgoing.remainingIrr) {
            setError('Settlement amount exceeds outgoing remaining debt');
            return;
        }

        if (settlementAmount > selectedIncoming.remainingIrr) {
            setError('Settlement amount exceeds incoming remaining funds');
            return;
        }

        try {
            setSettling(true);
            setError(null);

            await remittanceApi.createSettlement({
                outgoingRemittanceId: selectedOutgoing.id,
                incomingRemittanceId: selectedIncoming.id,
                amountIrr: settlementAmount,
            });

            setSuccess(`Settlement created! Profit: ${remittanceApi.formatCurrency(profitPreview.profitCad)}`);

            // Reset and reload
            setSelectedOutgoing(null);
            setSelectedIncoming(null);
            setSettlementAmount(0);
            await loadData();

            // Clear success message after 5 seconds
            setTimeout(() => setSuccess(null), 5000);
        } catch (err: any) {
            setError(err.message || 'Failed to create settlement');
        } finally {
            setSettling(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading remittances...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">🔗 Settle Remittances</h1>
                <p className="text-gray-600 mt-1">Match incoming funds with outgoing debts</p>
            </div>

            {/* Success Message */}
            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-green-800 font-medium">✅ {success}</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Empty State */}
            {outgoing.length === 0 && incoming.length === 0 && (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="text-6xl mb-4">🔗</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Remittances to Settle</h3>
                    <p className="text-gray-600 mb-6">Create some outgoing and incoming remittances first</p>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => router.push('/remittances/outgoing/create')}
                            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
                        >
                            📤 Create Outgoing
                        </button>
                        <button
                            onClick={() => router.push('/remittances/incoming/create')}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                        >
                            📥 Create Incoming
                        </button>
                    </div>
                </div>
            )}

            {/* Settlement Interface */}
            {(outgoing.length > 0 || incoming.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Outgoing (Left) */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            📤 Pending Outgoing
                            <span className="text-sm text-gray-500">({outgoing.length} debts to settle)</span>
                        </h2>

                        {outgoing.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>No pending outgoing remittances</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {outgoing.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelectOutgoing(item)}
                                        className={`p-4 border-2 rounded-lg cursor-pointer transition ${selectedOutgoing?.id === item.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-semibold text-gray-900">{item.remittanceCode}</div>
                                                <div className="text-sm text-gray-600">{item.recipientName}</div>
                                            </div>
                                            <div className={`text-xs px-2 py-1 rounded ${item.status === 'PENDING' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {item.status}
                                            </div>
                                        </div>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Total:</span>
                                                <span className="font-medium">{remittanceApi.formatCurrency(item.amountIrr, 'IRR')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Remaining:</span>
                                                <span className="font-bold text-red-600">{remittanceApi.formatCurrency(item.remainingIrr, 'IRR')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Buy Rate:</span>
                                                <span>{item.buyRateCad.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Cost:</span>
                                                <span>{remittanceApi.formatCurrency(item.remainingIrr / item.buyRateCad)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Incoming (Right) */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            📥 Available Incoming
                            <span className="text-sm text-gray-500">({incoming.length} funds available)</span>
                        </h2>

                        {incoming.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>No available incoming remittances</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {incoming.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelectIncoming(item)}
                                        className={`p-4 border-2 rounded-lg cursor-pointer transition ${selectedIncoming?.id === item.id
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-semibold text-gray-900">{item.remittanceCode}</div>
                                                <div className="text-sm text-gray-600">{item.senderName}</div>
                                            </div>
                                            <div className={`text-xs px-2 py-1 rounded ${item.status === 'PENDING' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {item.status}
                                            </div>
                                        </div>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Total:</span>
                                                <span className="font-medium">{remittanceApi.formatCurrency(item.amountIrr, 'IRR')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Available:</span>
                                                <span className="font-bold text-green-600">{remittanceApi.formatCurrency(item.remainingIrr, 'IRR')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Sell Rate:</span>
                                                <span>{item.sellRateCad.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Revenue:</span>
                                                <span>{remittanceApi.formatCurrency(item.remainingIrr / item.sellRateCad)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Settlement Preview */}
            {selectedOutgoing && selectedIncoming && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">💰 Settlement Preview</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="text-sm text-gray-600 mb-1">Selected Outgoing</div>
                            <div className="font-semibold text-gray-900">{selectedOutgoing.remittanceCode}</div>
                            <div className="text-sm text-gray-600">{selectedOutgoing.recipientName}</div>
                            <div className="mt-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Remaining Debt:</span>
                                    <span className="font-bold">{remittanceApi.formatCurrency(selectedOutgoing.remainingIrr, 'IRR')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="text-sm text-gray-600 mb-1">Selected Incoming</div>
                            <div className="font-semibold text-gray-900">{selectedIncoming.remittanceCode}</div>
                            <div className="text-sm text-gray-600">{selectedIncoming.senderName}</div>
                            <div className="mt-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Available Funds:</span>
                                    <span className="font-bold">{remittanceApi.formatCurrency(selectedIncoming.remainingIrr, 'IRR')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Amount Slider */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Settlement Amount (Toman)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max={getMaxSettlementAmount()}
                            step="1000"
                            value={settlementAmount}
                            onChange={(e) => setSettlementAmount(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between mt-2">
                            <input
                                type="number"
                                value={settlementAmount}
                                onChange={(e) => setSettlementAmount(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                min="0"
                                max={getMaxSettlementAmount()}
                                step="1000"
                            />
                            <button
                                onClick={() => setSettlementAmount(getMaxSettlementAmount())}
                                className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 whitespace-nowrap"
                            >
                                Max: {remittanceApi.formatCurrency(getMaxSettlementAmount(), 'IRR')}
                            </button>
                        </div>
                    </div>

                    {/* Profit Calculation */}
                    {settlementAmount > 0 && (
                        <div className={`border-2 rounded-lg p-6 ${profitPreview.profitCad >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}>
                            <h3 className="font-semibold mb-4">📊 Profit Calculation</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Cost (outgoing buy rate):</span>
                                    <span>{remittanceApi.formatCurrency(profitPreview.costCad)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Revenue (incoming sell rate):</span>
                                    <span>{remittanceApi.formatCurrency(profitPreview.revenueCad)}</span>
                                </div>
                                <div className="border-t border-gray-300 pt-2 mt-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold">
                                        {profitPreview.profitCad >= 0 ? 'Profit:' : 'Loss:'}
                                    </span>
                                    <span className={`text-2xl font-bold ${profitPreview.profitCad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {profitPreview.profitCad >= 0 ? '+' : ''}{remittanceApi.formatCurrency(profitPreview.profitCad)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Profit Margin:</span>
                                    <span className={profitPreview.profitCad >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {profitPreview.profitMargin.toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-gray-600 mb-1">After Settlement:</div>
                                    <div className="font-medium">
                                        • Outgoing {selectedOutgoing.remittanceCode}: {remittanceApi.formatCurrency(selectedOutgoing.remainingIrr - settlementAmount, 'IRR')} remaining
                                    </div>
                                    <div className="font-medium">
                                        • Incoming {selectedIncoming.remittanceCode}: {remittanceApi.formatCurrency(selectedIncoming.remainingIrr - settlementAmount, 'IRR')} remaining
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={() => {
                                setSelectedOutgoing(null);
                                setSelectedIncoming(null);
                                setSettlementAmount(0);
                                setError(null);
                            }}
                            className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
                            disabled={settling}
                        >
                            Clear Selection
                        </button>
                        <button
                            onClick={handleSettle}
                            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={settling || settlementAmount === 0}
                        >
                            {settling ? 'Settling...' : '✓ Settle Now'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
