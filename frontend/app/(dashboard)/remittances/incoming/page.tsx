'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { remittanceApi } from '@/src/lib/remittanceApi';
import { IncomingRemittance } from '@/src/models/remittance';
import { PAYMENT_METHOD_LABELS } from '@/src/models/remittance';
import Link from 'next/link';

export default function IncomingRemittancesList() {
    const router = useRouter();
    const [remittances, setRemittances] = useState<IncomingRemittance[]>([]);
    const [filteredRemittances, setFilteredRemittances] = useState<IncomingRemittance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadRemittances();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [remittances, statusFilter, searchQuery]);

    const loadRemittances = async () => {
        try {
            setLoading(true);
            const data = await remittanceApi.getIncoming();
            setRemittances(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load remittances');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...remittances];

        // Status filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(r => r.status === statusFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.remittanceCode.toLowerCase().includes(query) ||
                r.senderName.toLowerCase().includes(query) ||
                r.recipientName.toLowerCase().includes(query)
            );
        }

        setFilteredRemittances(filtered);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-green-100 text-green-800';
            case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
            case 'COMPLETED': return 'bg-blue-100 text-blue-800';
            case 'PAID': return 'bg-purple-100 text-purple-800';
            case 'CANCELLED': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
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

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                    <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={loadRemittances}
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
                    <h1 className="text-3xl font-bold text-gray-900">📥 Incoming Remittances</h1>
                    <p className="text-gray-600 mt-1">Iran → Canada Money Transfers</p>
                </div>
                <Link
                    href="/remittances/incoming/create"
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium"
                >
                    + Create New
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Filter by Status
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {['ALL', 'PENDING', 'PARTIAL', 'COMPLETED', 'PAID', 'CANCELLED'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-2 rounded-lg font-medium transition ${statusFilter === status
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {status === 'ALL' ? 'All' : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by code, sender, or recipient..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-600">
                Showing {filteredRemittances.length} of {remittances.length} remittances
            </div>

            {/* Empty State */}
            {filteredRemittances.length === 0 && (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="text-6xl mb-4">📥</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {remittances.length === 0 ? 'No Incoming Remittances' : 'No Results Found'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                        {remittances.length === 0
                            ? 'Create your first incoming remittance to get started'
                            : 'Try adjusting your filters or search query'}
                    </p>
                    {remittances.length === 0 && (
                        <Link
                            href="/remittances/incoming/create"
                            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                        >
                            Create Incoming Remittance
                        </Link>
                    )}
                </div>
            )}

            {/* Table */}
            {filteredRemittances.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Sender
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Allocation
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        To Pay
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRemittances.map((remittance) => {
                                    const allocation = remittanceApi.getAllocationPercentage(remittance);
                                    return (
                                        <tr key={remittance.id} className="hover:bg-gray-50 cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">{remittance.remittanceCode}</div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(remittance.createdAt).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{remittance.senderName}</div>
                                                <div className="text-sm text-gray-500">Sell: {remittance.sellRateCad.toLocaleString()}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">
                                                    {remittanceApi.formatCurrency(remittance.amountIrr, 'IRR')}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {remittanceApi.formatCurrency(remittance.equivalentCad)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                                    <div
                                                        className={`h-2 rounded-full ${allocation === 100 ? 'bg-blue-600' : allocation > 0 ? 'bg-yellow-500' : 'bg-green-500'
                                                            }`}
                                                        style={{ width: `${allocation}%` }}
                                                    ></div>
                                                </div>
                                                <div className="text-xs text-gray-600">{allocation.toFixed(0)}% allocated</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(remittance.status)}`}>
                                                    {remittance.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-gray-900">
                                                    {remittanceApi.formatCurrency(remittance.equivalentCad - (remittance.feeCAD || 0))}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {remittance.status === 'PAID' ? '✅ Paid' : 'Pending'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <Link
                                                    href={`/remittances/incoming/${remittance.id}`}
                                                    className="text-blue-600 hover:text-blue-900 font-medium"
                                                >
                                                    View Details →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Summary Stats */}
            {filteredRemittances.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Total Amount</div>
                        <div className="text-xl font-bold text-gray-900">
                            {remittanceApi.formatCurrency(
                                filteredRemittances.reduce((sum, r) => sum + r.amountIrr, 0),
                                'IRR'
                            )}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Allocated</div>
                        <div className="text-xl font-bold text-blue-600">
                            {remittanceApi.formatCurrency(
                                filteredRemittances.reduce((sum, r) => sum + r.allocatedIrr, 0),
                                'IRR'
                            )}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Available</div>
                        <div className="text-xl font-bold text-green-600">
                            {remittanceApi.formatCurrency(
                                filteredRemittances.reduce((sum, r) => sum + r.remainingIrr, 0),
                                'IRR'
                            )}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">To Pay Recipients</div>
                        <div className="text-xl font-bold text-gray-900">
                            {remittanceApi.formatCurrency(
                                filteredRemittances.reduce((sum, r) => sum + (r.equivalentCad - (r.feeCAD || 0)), 0)
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
