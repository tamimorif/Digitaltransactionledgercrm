'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { CreateIncomingRemittanceRequest } from '@/src/models/remittance';
import { getErrorMessage } from '@/src/lib/error';

export default function CreateIncomingRemittance() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreateIncomingRemittanceRequest>({
        senderName: '',
        senderPhone: '',
        senderIban: '',
        senderBank: '',
        recipientName: '',
        recipientPhone: '',
        recipientEmail: '',
        recipientAddress: '',
        amountIrr: 0,
        sellRateCad: 86500,
        feeCAD: 15,
        notes: '',
    });

    // Calculate CAD to pay recipient
    const calculateEquivalent = () => {
        if (formData.amountIrr > 0 && formData.sellRateCad > 0) {
            return formData.amountIrr / formData.sellRateCad;
        }
        return 0;
    };

    const equivalentCad = calculateEquivalent();
    const netToPay = equivalentCad - (formData.feeCAD || 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.senderName || !formData.senderPhone) {
            setError('Sender name and phone are required');
            return;
        }

        if (!formData.recipientName) {
            setError('Recipient name is required');
            return;
        }

        if (formData.amountIrr <= 0) {
            setError('Amount must be greater than 0');
            return;
        }

        if (formData.sellRateCad <= 0) {
            setError('Sell rate must be greater than 0');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await remittanceApi.createIncoming(formData);

            // Success! Redirect to dashboard
            router.push('/remittances/dashboard');
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to create remittance'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">📥 Create Incoming Remittance</h1>
                <p className="text-gray-600 mt-1">Iran → Canada Money Transfer</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sender Information (in Iran) */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        👤 Sender Information <span className="text-sm text-gray-500">(in Iran)</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                نام کامل / Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.senderName}
                                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="محمد رضایی / Mohammad Rezaei"
                                required
                                dir="rtl"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={formData.senderPhone}
                                onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="+98-912-123-4567"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                IBAN <span className="text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.senderIban}
                                onChange={(e) => setFormData({ ...formData, senderIban: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                                placeholder="IR062960000000100324200001"
                                maxLength={26}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                بانک / Bank <span className="text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.senderBank}
                                onChange={(e) => setFormData({ ...formData, senderBank: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="بانک صادرات / Bank Saderat"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                {/* Recipient Information (in Canada) */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        👥 Recipient Information <span className="text-sm text-gray-500">(in Canada)</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipientName}
                                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Sarah Johnson"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone <span className="text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="tel"
                                value={formData.recipientPhone}
                                onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="+1-416-555-5678"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email <span className="text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="email"
                                value={formData.recipientEmail}
                                onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="sarah@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Address <span className="text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipientAddress}
                                onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="123 Main St, Toronto"
                            />
                        </div>
                    </div>
                </div>

                {/* Transaction Details */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">💰 Transaction Details</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Amount (Toman) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.amountIrr || ''}
                                onChange={(e) => setFormData({ ...formData, amountIrr: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="150000000"
                                required
                                min="1"
                                step="1000"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.amountIrr > 0 && remittanceApi.formatCurrency(formData.amountIrr, 'IRR')}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Sell Rate (Toman/CAD) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.sellRateCad || ''}
                                onChange={(e) => setFormData({ ...formData, sellRateCad: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="86500"
                                required
                                min="1"
                                step="100"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                📊 Current market rate (adjust as needed)
                            </p>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">CAD to Pay:</span>
                                <span className="text-2xl font-bold text-green-600">
                                    {remittanceApi.formatCurrency(equivalentCad)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Processing Fee:</span>
                                <span className="text-lg font-semibold text-gray-900">
                                    - {remittanceApi.formatCurrency(formData.feeCAD || 0)}
                                </span>
                            </div>
                            <div className="border-t border-green-300 pt-2 mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-700">Net to Pay Recipient:</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        {remittanceApi.formatCurrency(netToPay)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Processing Fee (CAD)
                            </label>
                            <input
                                type="number"
                                value={formData.feeCAD || ''}
                                onChange={(e) => setFormData({ ...formData, feeCAD: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="15.00"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes <span className="text-gray-400">(Optional)</span>
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Student tuition payment"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">💡</div>
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-1">Next Steps</h3>
                            <p className="text-sm text-blue-800">
                                After creating this incoming remittance, you can allocate it to settle pending outgoing remittances.
                                Go to the <strong>Settlement page</strong> to match this with outgoing debts and calculate profit.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : '✓ Create Incoming Remittance'}
                    </button>
                </div>
            </form>
        </div>
    );
}
