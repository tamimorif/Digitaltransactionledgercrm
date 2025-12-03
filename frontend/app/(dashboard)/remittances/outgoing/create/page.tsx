'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { CreateOutgoingRemittanceRequest } from '@/src/models/remittance';

export default function CreateOutgoingRemittance() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreateOutgoingRemittanceRequest>({
        senderName: '',
        senderPhone: '',
        senderEmail: '',
        recipientName: '',
        recipientPhone: '',
        recipientIban: '',
        recipientBank: '',
        recipientAddress: '',
        amountIrr: 0,
        buyRateCad: 85000,
        receivedCad: 0,
        feeCAD: 25,
        notes: '',
    });

    // Calculate CAD equivalent whenever amount or rate changes
    const calculateEquivalent = () => {
        if (formData.amountIrr > 0 && formData.buyRateCad > 0) {
            return formData.amountIrr / formData.buyRateCad;
        }
        return 0;
    };

    const equivalentCad = calculateEquivalent();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.senderName || !formData.senderPhone) {
            setError('Sender name and phone are required');
            return;
        }

        if (!formData.recipientName || !formData.recipientIban) {
            setError('Recipient name and IBAN are required');
            return;
        }

        if (formData.amountIrr <= 0) {
            setError('Amount must be greater than 0');
            return;
        }

        if (formData.buyRateCad <= 0) {
            setError('Buy rate must be greater than 0');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await remittanceApi.createOutgoing(formData);

            // Success! Redirect to dashboard
            router.push('/remittances/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to create remittance');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">📤 Create Outgoing Remittance</h1>
                <p className="text-gray-600 mt-1">Canada → Iran Money Transfer</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sender Information */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        👤 Sender Information <span className="text-sm text-gray-500">(in Canada)</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.senderName}
                                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="John Smith"
                                required
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
                                placeholder="+1-416-555-1234"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email <span className="text-gray-400">(Optional)</span>
                            </label>
                            <input
                                type="email"
                                value={formData.senderEmail}
                                onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>
                </div>

                {/* Recipient Information */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        👥 Recipient Information <span className="text-sm text-gray-500">(in Iran)</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                نام کامل / Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipientName}
                                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="علی رضایی / Ali Rezaei"
                                required
                                dir="rtl"
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
                                placeholder="+98-912-123-4567"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                IBAN <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipientIban}
                                onChange={(e) => setFormData({ ...formData, recipientIban: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                                placeholder="IR820540102680020817909002"
                                required
                                maxLength={26}
                            />
                            <p className="text-xs text-gray-500 mt-1">26 digits starting with IR</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                بانک / Bank <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipientBank}
                                onChange={(e) => setFormData({ ...formData, recipientBank: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="بانک ملت / Bank Mellat"
                                required
                                dir="rtl"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                آدرس / Address <span className="text-gray-400">(Optional)</span>
                            </label>
                            <textarea
                                value={formData.recipientAddress}
                                onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="تهران، خیابان ولیعصر، پلاک 123"
                                rows={2}
                                dir="rtl"
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
                                placeholder="200000000"
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
                                Buy Rate (Toman/CAD) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.buyRateCad || ''}
                                onChange={(e) => setFormData({ ...formData, buyRateCad: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="85000"
                                required
                                min="1"
                                step="100"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                📊 Current market rate (adjust as needed)
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Equivalent CAD:</span>
                                <span className="text-2xl font-bold text-blue-600">
                                    {remittanceApi.formatCurrency(equivalentCad)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Fee:</span>
                                <span className="text-lg font-semibold text-gray-900">
                                    {remittanceApi.formatCurrency(formData.feeCAD || 0)}
                                </span>
                            </div>
                            <div className="border-t border-blue-300 pt-2 mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-700">Total Cost:</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        {remittanceApi.formatCurrency(equivalentCad + (formData.feeCAD || 0))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Received from Customer (CAD) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={formData.receivedCad || ''}
                                    onChange={(e) => setFormData({ ...formData, receivedCad: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={equivalentCad.toFixed(2)}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fee (CAD)
                                </label>
                                <input
                                    type="number"
                                    value={formData.feeCAD || ''}
                                    onChange={(e) => setFormData({ ...formData, feeCAD: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="25.00"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes <span className="text-gray-400">(Optional)</span>
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Family support - December 2024"
                                rows={3}
                            />
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
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : '✓ Create Remittance'}
                    </button>
                </div>
            </form>
        </div>
    );
}
