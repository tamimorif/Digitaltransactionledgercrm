'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Search, Package, Phone, User, MapPin, Calendar, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Separator } from '@/src/components/ui/separator';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { useSearchPickupByCode, useMarkAsPickedUp, useCancelPickupTransaction } from '@/src/lib/queries/pickup.query';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { toast } from 'sonner';
import TransactionPaymentsSection from '@/src/components/payments/TransactionPaymentsSection';

export default function PickupSearchPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Redirect SuperAdmin to admin dashboard
    useEffect(() => {
        if (user?.role === 'superadmin') {
            router.push('/admin');
        }
    }, [user, router]);

    const [searchMode, setSearchMode] = useState<'code' | 'query'>('code');
    const [searchCode, setSearchCode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [selectedPickup, setSelectedPickup] = useState<PickupTransaction | null>(null);
    const [queryResults, setQueryResults] = useState<PickupTransaction[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        amountMin: '',
        amountMax: '',
        status: 'ALL',
        currency: 'ALL',
    });

    const { data: pickup, isLoading, error, refetch } = useSearchPickupByCode(activeCode);
    const markAsPickedUpMutation = useMarkAsPickedUp();
    const cancelPickupMutation = useCancelPickupTransaction();

    const handleSearch = () => {
        if (searchMode === 'code') {
            // Updated to match new format: 1 letter + dash + 4 digits (e.g., A-1234)
            if (searchCode.trim().length === 6 && /^[A-Z]-\d{4}$/i.test(searchCode.trim())) {
                setActiveCode(searchCode.trim().toUpperCase());
                setActiveQuery('');
                setQueryResults([]);
            } else {
                toast.error('Please enter a valid code (e.g., A-1234)');
            }
        } else {
            if (searchQuery.trim().length >= 3) {
                setActiveQuery(searchQuery.trim());
                setActiveCode('');
                // Fetch query results
                fetchPickupsByQuery(searchQuery.trim());
            } else {
                toast.error('Please enter at least 3 characters');
            }
        }
    };

    const fetchPickupsByQuery = async (query: string) => {
        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

            // Build query string with filters
            const params = new URLSearchParams();
            params.append('q', query);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);
            if (filters.amountMin) params.append('amountMin', filters.amountMin);
            if (filters.amountMax) params.append('amountMax', filters.amountMax);
            if (filters.status !== 'ALL') params.append('status', filters.status);
            if (filters.currency !== 'ALL') params.append('currency', filters.currency);

            const response = await fetch(`${API_BASE_URL}/api/pickups/search?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Apply client-side filtering as fallback
                let filtered = data;
                if (filters.amountMin) {
                    filtered = filtered.filter((p: any) => p.amount >= parseFloat(filters.amountMin));
                }
                if (filters.amountMax) {
                    filtered = filtered.filter((p: any) => p.amount <= parseFloat(filters.amountMax));
                }
                if (filters.status !== 'ALL') {
                    filtered = filtered.filter((p: any) => p.status === filters.status);
                }
                if (filters.currency !== 'ALL') {
                    filtered = filtered.filter((p: any) => p.currency === filters.currency);
                }
                setQueryResults(filtered);
                toast.success(`Found ${filtered.length} results`);
            } else {
                toast.error('Failed to search pickups');
            }
        } catch (error) {
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
            setSearchCode('');
            setActiveCode('');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to mark pickup as completed');
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
            setSearchCode('');
            setActiveCode('');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to cancel pickup');
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
        <div className="container max-w-6xl mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Receive Money</h1>
                    <p className="text-muted-foreground">Search for pending money transfers by code</p>
                </div>
            </div>

            {/* Search Box */}
            <Card>
                <CardHeader>
                    <CardTitle>Search Money Transfer</CardTitle>
                    <CardDescription>Search by code, phone number, or recipient name</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Search Mode Tabs */}
                        <div className="flex gap-2 border-b">
                            <Button
                                variant={searchMode === 'code' ? 'default' : 'ghost'}
                                onClick={() => setSearchMode('code')}
                                className="rounded-b-none"
                            >
                                By Code
                            </Button>
                            <Button
                                variant={searchMode === 'query' ? 'default' : 'ghost'}
                                onClick={() => setSearchMode('query')}
                                className="rounded-b-none"
                            >
                                By Phone/Name
                            </Button>
                            {searchMode === 'query' && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="rounded-b-none ml-auto"
                                    size="sm"
                                >
                                    {showFilters ? 'Hide' : 'Show'} Filters
                                </Button>
                            )}
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && searchMode === 'query' && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border space-y-4">
                                <p className="text-sm font-medium">Advanced Filters</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="dateFrom" className="text-xs">Date From</Label>
                                        <Input
                                            id="dateFrom"
                                            type="date"
                                            value={filters.dateFrom}
                                            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="dateTo" className="text-xs">Date To</Label>
                                        <Input
                                            id="dateTo"
                                            type="date"
                                            value={filters.dateTo}
                                            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="status" className="text-xs">Status</Label>
                                        <select
                                            id="status"
                                            value={filters.status}
                                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                            className="w-full p-2 border rounded-md text-sm"
                                        >
                                            <option value="ALL">All Statuses</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="PICKED_UP">Completed</option>
                                            <option value="CANCELLED">Cancelled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="amountMin" className="text-xs">Min Amount</Label>
                                        <Input
                                            id="amountMin"
                                            type="number"
                                            value={filters.amountMin}
                                            onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="amountMax" className="text-xs">Max Amount</Label>
                                        <Input
                                            id="amountMax"
                                            type="number"
                                            value={filters.amountMax}
                                            onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                                            placeholder="999999"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="currency" className="text-xs">Currency</Label>
                                        <select
                                            id="currency"
                                            value={filters.currency}
                                            onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
                                            className="w-full p-2 border rounded-md text-sm"
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilters({
                                        dateFrom: '',
                                        dateTo: '',
                                        amountMin: '',
                                        amountMax: '',
                                        status: 'ALL',
                                        currency: 'ALL',
                                    })}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}

                        {/* Search Input */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                {searchMode === 'code' ? (
                                    <Input
                                        type="text"
                                        placeholder="Enter 6-digit code (e.g., 123456)"
                                        value={searchCode}
                                        onChange={(e) => setSearchCode(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="pl-10"
                                        maxLength={6}
                                    />
                                ) : (
                                    <Input
                                        type="text"
                                        placeholder="Search by phone number or recipient name"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="pl-10"
                                    />
                                )}
                            </div>
                            <Button onClick={handleSearch} disabled={isLoading}>
                                {isLoading ? 'Searching...' : 'Search'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Query Results (Multiple Pickups) - Enhanced with Full Details */}
            {activeQuery && queryResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Search Results ({queryResults.length})</CardTitle>
                        <CardDescription>All transfer orders matching your search</CardDescription>
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
            {activeQuery && queryResults.length === 0 && !isLoading && (
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-yellow-700">
                            <Search className="h-5 w-5" />
                            <p className="font-medium">No pending pickups found matching "{activeQuery}"</p>
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
                                    transaction={{
                                        id: pickup.id,
                                        totalReceived: pickup.totalReceived || 0,
                                        receivedCurrency: pickup.receivedCurrency || pickup.receiverCurrency || pickup.currency,
                                        totalPaid: pickup.totalPaid || 0,
                                        remainingBalance: pickup.remainingBalance || 0,
                                        paymentStatus: pickup.paymentStatus || 'OPEN',
                                        allowPartialPayment: true,
                                        payments: pickup.payments || []
                                    } as any}
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
                                <p>Please verify the following information matches the recipient's ID:</p>
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
                                    ⚠️ Ensure you have verified the recipient's government-issued ID before proceeding.
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
        </div>
    );
}
