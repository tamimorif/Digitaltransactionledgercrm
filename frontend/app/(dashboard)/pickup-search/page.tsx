'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { ArrowRight, Calendar, CheckCircle, MapPin, Package, Phone, Search, User, Wallet, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Separator } from '@/src/components/ui/separator';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { useSearchPickupByCode, useMarkAsPickedUp, useCancelPickupTransaction } from '@/src/lib/queries/pickup.query';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { toast } from 'sonner';
import { getErrorMessage } from '@/src/lib/error';
import apiClient from '@/src/lib/api-client';
import TransactionPaymentsSection from '@/src/components/payments/TransactionPaymentsSection';
import { toPaymentTransaction } from '@/src/lib/transaction-adapter';

export default function PickupSearchPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Redirect SuperAdmin to admin dashboard
    useEffect(() => {
        if (user?.role === 'superadmin') {
            router.push('/admin');
        }
    }, [user, router]);

    const [searchInput, setSearchInput] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [hasQuerySearch, setHasQuerySearch] = useState(false);
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [selectedPickup, setSelectedPickup] = useState<PickupTransaction | null>(null);
    const [queryResults, setQueryResults] = useState<PickupTransaction[]>([]);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        amountMin: '',
        amountMax: '',
        status: 'ALL',
        currency: 'ALL',
    });

    const { data: pickup, isLoading, error } = useSearchPickupByCode(activeCode);
    const markAsPickedUpMutation = useMarkAsPickedUp();
    const cancelPickupMutation = useCancelPickupTransaction();

    const handleSearch = () => {
        const trimmed = searchInput.trim();
        const hasFilters = Boolean(
            filters.dateFrom ||
            filters.dateTo ||
            filters.amountMin ||
            filters.amountMax ||
            filters.status !== 'ALL' ||
            filters.currency !== 'ALL'
        );

        if (!trimmed && !hasFilters) {
            toast.error('Please enter a code, phone, name, or amount');
            return;
        }

        // Code format: 1 letter + dash + 4 digits (e.g., A-1234)
        if (trimmed && trimmed.length === 6 && /^[A-Z]-\d{4}$/i.test(trimmed)) {
            setActiveCode(trimmed.toUpperCase());
            setActiveQuery('');
            setQueryResults([]);
            setHasQuerySearch(false);
            return;
        }

        if (trimmed) {
            const isNumeric = /^\d+(\.\d+)?$/.test(trimmed);
            if (!isNumeric && trimmed.length < 3) {
                toast.error('Please enter at least 3 characters');
                return;
            }
        }

        setActiveQuery(trimmed);
        setActiveCode('');
        setHasQuerySearch(true);
        fetchPickupsByQuery(trimmed);
    };

    const fetchPickupsByQuery = async (query: string) => {
        try {
            // Build query string with filters
            const params: Record<string, string> = {};
            if (query) params.q = query;
            if (filters.dateFrom) params.dateFrom = filters.dateFrom;
            if (filters.dateTo) params.dateTo = filters.dateTo;
            if (filters.amountMin) params.amountMin = filters.amountMin;
            if (filters.amountMax) params.amountMax = filters.amountMax;
            if (filters.status !== 'ALL') params.status = filters.status;
            if (filters.currency !== 'ALL') params.currency = filters.currency;

            const response = await apiClient.get<PickupTransaction[]>('/pickups/search', { params });
            if (response.status >= 200 && response.status < 300) {
                const data = response.data;
                // Apply client-side filtering as fallback
                let filtered = data;
                if (filters.amountMin) {
                    filtered = filtered.filter((p) => p.amount >= parseFloat(filters.amountMin));
                }
                if (filters.amountMax) {
                    filtered = filtered.filter((p) => p.amount <= parseFloat(filters.amountMax));
                }
                if (filters.status !== 'ALL') {
                    filtered = filtered.filter((p) => p.status === filters.status);
                }
                if (filters.currency !== 'ALL') {
                    filtered = filtered.filter((p) => p.currency === filters.currency);
                }
                setQueryResults(filtered);
                toast.success(`Found ${filtered.length} results`);
            } else {
                toast.error('Failed to search pickups');
            }
        } catch {
            toast.error('Error searching pickups');
        }
    };

    const handlePickupSelect = (pickup: PickupTransaction) => {
        setSelectedPickup(pickup);
        setShowVerifyDialog(true);
    };

    const handleVerifyClick = () => {
        if (pickup && pickup.status === 'PENDING') {
            setSelectedPickup(pickup);
            setShowVerifyDialog(true);
        }
    };

    const handleMarkAsPickedUp = async () => {
        if (!selectedPickup) return;

        try {
            await markAsPickedUpMutation.mutateAsync(selectedPickup.id);
            toast.success('Pickup marked as completed successfully!');
            setShowVerifyDialog(false);
            setSelectedPickup(null);
            setSearchInput('');
            setActiveCode('');
            setActiveQuery('');
            setQueryResults([]);
            setHasQuerySearch(false);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to mark pickup as completed'));
        }
    };

    const handleCancelClick = () => {
        if (pickup && pickup.status === 'PENDING') {
            setSelectedPickup(pickup);
            setShowCancelDialog(true);
        }
    };

    const handleCancelPickup = async () => {
        if (!selectedPickup || !cancelReason.trim()) {
            toast.error('Please provide a cancellation reason');
            return;
        }

        try {
            await cancelPickupMutation.mutateAsync({ id: selectedPickup.id, reason: cancelReason.trim() });
            toast.success('Pickup cancelled successfully');
            setShowCancelDialog(false);
            setSelectedPickup(null);
            setCancelReason('');
            setSearchInput('');
            setActiveCode('');
            setActiveQuery('');
            setQueryResults([]);
            setHasQuerySearch(false);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to cancel pickup'));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>;
            case 'PICKED_UP':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Picked Up</Badge>;
            case 'CANCELLED':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Cancelled</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    // Don't render for SuperAdmin
    if (user?.role === 'superadmin') {
        return null;
    }

    return (
        <main className="w-full max-w-[900px] mx-auto py-10 px-4 md:px-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.025)] overflow-hidden">

                {/* Header */}
                <div className="p-8 border-b border-slate-200">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Receive Money</h1>
                    <p className="text-[15px] text-slate-500 leading-normal">
                        Enter the transaction details provided by the sender to track or claim funds.
                    </p>
                </div>

                <div className="p-8">
                    {/* Primary Search Section */}
                    <div className="flex flex-col md:flex-row gap-3 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 text-base border-2 border-slate-200 rounded-[10px] outline-none focus:border-blue-600 transition-colors placeholder:text-slate-400"
                                placeholder="Search by transaction code (e.g. A-1234), phone, or name..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-[10px] border-none cursor-pointer text-[15px] flex items-center justify-center gap-2 transition-colors whitespace-nowrap md:w-auto w-full disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <span>{isLoading ? 'Searching...' : 'Find Transaction'}</span>
                            {!isLoading && <ArrowRight className="w-[18px] h-[18px]" />}
                        </button>
                    </div>

                    {/* Filters Container */}
                    <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-6">
                        <div className="flex justify-between items-center mb-5">
                            <span className="text-[13px] font-bold uppercase text-slate-400 tracking-wide">Advanced Filters</span>
                            <button
                                onClick={() => setFilters({
                                    dateFrom: '',
                                    dateTo: '',
                                    amountMin: '',
                                    amountMax: '',
                                    status: 'ALL',
                                    currency: 'ALL',
                                })}
                                className="bg-none border-none text-slate-500 text-[13px] font-medium cursor-pointer underline decoration-transparent hover:text-blue-600 hover:decoration-blue-600 transition-all"
                            >
                                Clear all filters
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Status */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-slate-900">Status</label>
                                <div className="relative">
                                    <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                    <select
                                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 focus:border-blue-600 transition-colors appearance-none cursor-pointer"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                        value={filters.status}
                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="PICKED_UP">Completed</option>
                                        <option value="CANCELLED">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* From Date */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-slate-900">From Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 focus:border-blue-600 transition-colors text-slate-500"
                                        value={filters.dateFrom}
                                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* To Date */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-slate-900">To Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 focus:border-blue-600 transition-colors text-slate-500"
                                        value={filters.dateTo}
                                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Currency */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-slate-900">Currency</label>
                                <div className="relative">
                                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                    <select
                                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 focus:border-blue-600 transition-colors appearance-none cursor-pointer"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                        value={filters.currency}
                                        onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
                                    >
                                        <option value="ALL">All Currencies</option>
                                        <option value="USD">USD</option>
                                        <option value="CAD">CAD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                        <option value="IRR">IRR</option>
                                    </select>
                                </div>
                            </div>

                            {/* Min Amount */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-slate-900">Min Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 focus:border-blue-600 transition-colors placeholder:text-slate-400"
                                        value={filters.amountMin}
                                        onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Max Amount */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-slate-900">Max Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">$</span>
                                    <input
                                        type="number"
                                        placeholder="999,999.00"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 focus:border-blue-600 transition-colors placeholder:text-slate-400"
                                        value={filters.amountMax}
                                        onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SPACER for Results */}
            <div className="h-8"></div>

            {/* Query Results (Multiple Pickups) - Enhanced with Full Details */}
            {hasQuerySearch && queryResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Search Results ({queryResults.length})</CardTitle>
                        <CardDescription>All transfer orders matching your search or filters</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {queryResults.map((pickupItem) => (
                                <Card key={pickupItem.id} className={`border-l-4 ${pickupItem.status === 'PENDING' ? 'border-l-yellow-500' :
                                    pickupItem.status === 'PICKED_UP' ? 'border-l-green-500' :
                                        'border-l-red-500'
                                    }`}>
                                    <CardContent className="pt-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* Left Side - Transaction Details */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-bold font-mono text-primary">
                                                            {pickupItem.pickupCode}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(pickupItem.createdAt).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                    {getStatusBadge(pickupItem.status)}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-muted-foreground">From</p>
                                                            <p className="font-medium">{pickupItem.senderName}</p>
                                                            <p className="text-sm text-muted-foreground">{pickupItem.senderPhone}</p>
                                                        </div>
                                                        <User className="h-5 w-5 text-muted-foreground" />
                                                        <div className="flex-1">
                                                            <p className="text-xs text-muted-foreground">To</p>
                                                            <p className="font-medium">{pickupItem.recipientName}</p>
                                                            <p className="text-sm text-muted-foreground">{pickupItem.recipientPhone}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Branch Information */}
                                                {pickupItem.senderBranch && pickupItem.receiverBranch && (
                                                    <div className="pt-2 border-t">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Sender Branch</p>
                                                                <p className="font-medium">{pickupItem.senderBranch.name}</p>
                                                                <p className="text-xs text-muted-foreground font-mono">{pickupItem.senderBranch.branchCode}</p>
                                                            </div>
                                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                                            <div className="text-right">
                                                                <p className="text-xs text-muted-foreground">Receiver Branch</p>
                                                                <p className="font-medium">{pickupItem.receiverBranch.name}</p>
                                                                <p className="text-xs text-muted-foreground font-mono">{pickupItem.receiverBranch.branchCode}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right Side - Amount Details */}
                                            <div className="space-y-4">
                                                <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-muted-foreground">Send Amount</span>
                                                        <span className="text-xl font-bold">
                                                            {pickupItem.amount.toFixed(2)} {pickupItem.currency}
                                                        </span>
                                                    </div>

                                                    {pickupItem.receiverCurrency && pickupItem.receiverCurrency !== pickupItem.currency && (
                                                        <>
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="text-muted-foreground">Exchange Rate</span>
                                                                <span className="font-mono">
                                                                    1 {pickupItem.currency} = {pickupItem.exchangeRate?.toFixed(4)} {pickupItem.receiverCurrency}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between border-t pt-2">
                                                                <span className="text-sm text-muted-foreground">Receive Amount</span>
                                                                <span className="text-xl font-bold text-green-600">
                                                                    {pickupItem.receiverAmount?.toFixed(2)} {pickupItem.receiverCurrency}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="flex items-center justify-between text-sm border-t pt-2">
                                                        <span className="text-muted-foreground">Fees</span>
                                                        <span className="font-medium">{(pickupItem.fees || 0).toFixed(2)} {pickupItem.currency}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between border-t pt-2">
                                                        <span className="text-sm font-medium">Total Cost</span>
                                                        <span className="text-lg font-bold">
                                                            {(pickupItem.amount + (pickupItem.fees || 0)).toFixed(2)} {pickupItem.currency}
                                                        </span>
                                                    </div>
                                                </div>

                                                {pickupItem.notes && (
                                                    <div className="text-sm">
                                                        <p className="text-muted-foreground mb-1">Notes:</p>
                                                        <p className="italic">{pickupItem.notes}</p>
                                                    </div>
                                                )}

                                                {/* Action Button */}
                                                {pickupItem.status === 'PENDING' && (
                                                    <Button
                                                        onClick={() => handlePickupSelect(pickupItem)}
                                                        className="w-full"
                                                        variant="default"
                                                    >
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Verify & Mark as Given
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No Results for Query */}
            {hasQuerySearch && queryResults.length === 0 && !isLoading && (
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-yellow-700">
                            <Search className="h-5 w-5" />
                            <p className="font-medium">
                                {activeQuery
                                    ? `No pending pickups found matching "${activeQuery}"`
                                    : 'No pending pickups found for the current filters.'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {error && activeCode && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-red-700">
                            <XCircle className="h-5 w-5" />
                            <p className="font-medium">No pickup found with code: {activeCode}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pickup Details */}
            {pickup && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Package className="h-6 w-6 text-primary" />
                                <div>
                                    <CardTitle>Pickup Code: {pickup.pickupCode}</CardTitle>
                                    <CardDescription>
                                        Created on {new Date(pickup.createdAt).toLocaleDateString()}
                                    </CardDescription>
                                </div>
                            </div>
                            {getStatusBadge(pickup.status)}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Transaction Details */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground mb-1">Amount Sent</p>
                                <p className="text-2xl font-bold text-primary">
                                    {pickup.amount.toFixed(2)} {pickup.currency}
                                </p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground mb-1">Amount to Receive</p>
                                <p className="text-2xl font-bold text-green-700">
                                    {pickup.receiverAmount ? pickup.receiverAmount.toFixed(2) : pickup.amount.toFixed(2)} {pickup.receiverCurrency || pickup.currency}
                                </p>
                            </div>
                        </div>

                        {/* Exchange Details */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-muted rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Exchange Rate</p>
                                <p className="text-lg font-semibold">
                                    {pickup.exchangeRate ? pickup.exchangeRate.toFixed(4) : '1.0000'}
                                </p>
                            </div>
                            <div className="bg-muted rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Transfer Fees</p>
                                <p className="text-lg font-semibold">
                                    {pickup.fees ? pickup.fees.toFixed(2) : '0.00'} {pickup.currency}
                                </p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Total Cost</p>
                                <p className="text-lg font-semibold text-blue-700">
                                    {(pickup.amount + (pickup.fees || 0)).toFixed(2)} {pickup.currency}
                                </p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Sender Information */}
                            <div className="space-y-3">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Sender Information
                                </h3>
                                <Separator />
                                <div className="space-y-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Branch</Label>
                                        <p className="font-medium">{pickup.senderBranch?.name || 'N/A'}</p>
                                        <p className="text-sm text-muted-foreground">{pickup.senderBranch?.branchCode}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Sender Name</Label>
                                        <p className="font-medium flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {pickup.senderName}
                                        </p>
                                    </div>
                                    {pickup.senderPhone && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Sender Phone</Label>
                                            <p className="font-medium flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                {pickup.senderPhone}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recipient Information */}
                            <div className="space-y-3">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Recipient Information
                                </h3>
                                <Separator />
                                <div className="space-y-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Receiving Branch</Label>
                                        <p className="font-medium">{pickup.receiverBranch?.name || 'N/A'}</p>
                                        <p className="text-sm text-muted-foreground">{pickup.receiverBranch?.branchCode}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Recipient Name</Label>
                                        <p className="font-medium flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {pickup.recipientName}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Recipient Phone</Label>
                                        <p className="font-medium flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            {pickup.recipientPhone}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {pickup.notes && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Notes</Label>
                                <p className="text-sm bg-muted p-3 rounded-md">{pickup.notes}</p>
                            </div>
                        )}

                        {/* Status-specific Information */}
                        {pickup.status === 'PICKED_UP' && pickup.pickedUpAt && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-green-700 mb-2">
                                    <CheckCircle className="h-5 w-5" />
                                    <p className="font-semibold">Pickup Completed</p>
                                </div>
                                <p className="text-sm text-green-600">
                                    Picked up on {new Date(pickup.pickedUpAt).toLocaleString()}
                                    {pickup.pickedUpByUser && ` by ${pickup.pickedUpByUser.fullName}`}
                                </p>
                            </div>
                        )}

                        {pickup.status === 'CANCELLED' && pickup.cancelledAt && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-700 mb-2">
                                    <XCircle className="h-5 w-5" />
                                    <p className="font-semibold">Pickup Cancelled</p>
                                </div>
                                <p className="text-sm text-red-600">
                                    Cancelled on {new Date(pickup.cancelledAt).toLocaleString()}
                                    {pickup.cancelledByUser && ` by ${pickup.cancelledByUser.fullName}`}
                                </p>
                                {pickup.cancellationReason && (
                                    <p className="text-sm text-red-600 mt-2">
                                        <span className="font-medium">Reason:</span> {pickup.cancellationReason}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Payment Management Section */}
                        {pickup.allowPartialPayment && (
                            <div className="border-t pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Wallet className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold">Payment Management</h3>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                        Multi-Payment Mode
                                    </Badge>
                                </div>
                                <TransactionPaymentsSection
                                    transaction={toPaymentTransaction(pickup)}
                                />
                            </div>
                        )}

                        {/* Action Buttons */}
                        {pickup.status === 'PENDING' && (
                            <div className="flex gap-3 pt-4">
                                <Button
                                    onClick={handleVerifyClick}
                                    className="flex-1"
                                    size="lg"
                                    disabled={markAsPickedUpMutation.isPending}
                                >
                                    <CheckCircle className="mr-2 h-5 w-5" />
                                    {markAsPickedUpMutation.isPending ? 'Processing...' : 'Verify & Mark as Picked Up'}
                                </Button>
                                <Button
                                    onClick={handleCancelClick}
                                    variant="outline"
                                    size="lg"
                                    disabled={cancelPickupMutation.isPending}
                                >
                                    <XCircle className="mr-2 h-5 w-5" />
                                    Cancel Pickup
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Verification Dialog */}
            <AlertDialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verify Identity & Complete Pickup</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 pt-2">
                                <p>Please verify the following information matches the recipient&apos;s ID:</p>
                                <div className="bg-muted p-4 rounded-lg space-y-2">
                                    <div>
                                        <Label className="text-xs font-semibold">Pickup Code</Label>
                                        <p className="text-lg font-bold">{selectedPickup?.pickupCode}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold">Recipient Name</Label>
                                        <p className="font-medium">{selectedPickup?.recipientName}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold">Recipient Phone</Label>
                                        <p className="font-medium">{selectedPickup?.recipientPhone}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold">Amount</Label>
                                        <p className="text-xl font-bold text-primary">
                                            {selectedPickup?.amount.toFixed(2)} {selectedPickup?.currency}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    ⚠️ Ensure you have verified the recipient&apos;s government-issued ID before proceeding.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMarkAsPickedUp} disabled={markAsPickedUpMutation.isPending}>
                            {markAsPickedUpMutation.isPending ? 'Processing...' : 'Verified - Complete Pickup'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Cancel Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Pickup Transaction</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for cancelling this pickup transaction.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Pickup Code</Label>
                            <p className="font-bold text-lg">{selectedPickup?.pickupCode}</p>
                        </div>
                        <div>
                            <Label htmlFor="cancelReason">Cancellation Reason *</Label>
                            <Textarea
                                id="cancelReason"
                                placeholder="e.g., Recipient requested cancellation, incorrect details, etc."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                            Close
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancelPickup}
                            disabled={!cancelReason.trim() || cancelPickupMutation.isPending}
                        >
                            {cancelPickupMutation.isPending ? 'Cancelling...' : 'Cancel Pickup'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
