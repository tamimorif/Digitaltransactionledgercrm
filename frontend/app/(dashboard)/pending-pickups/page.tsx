'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Loader2, Package, ArrowRight, Calendar, DollarSign, CheckCircle, Edit, Download, FileSpreadsheet, FileText, MapPin, Printer, Search, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMarkAsPickedUp } from '@/src/lib/queries/pickup.query';
import { EditPickupDialog } from '@/src/components/EditPickupDialog';
import { ManagePaymentsDialog } from '@/src/components/ManagePaymentsDialog';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { exportToCSV, exportToExcel, exportToPDF, type ExportTransaction } from '@/src/lib/export';
import { LiveIndicator } from '@/src/components/LiveIndicator';
import { useWebSocket, usePickupUpdates } from '@/src/hooks/useWebSocket';
import type { WSMessage } from '@/src/lib/websocket.service';
import apiClient from '@/src/lib/api-client';


interface PendingPickup {
    id: number;
    pickupCode: string;
    controlNumber?: string;
    transactionType?: string;
    disbursementType?: string;
    senderBranch: { id: number; name: string; branchCode: string };
    receiverBranch: { id: number; name: string; branchCode: string };
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone: string;
    amount: number;
    currency: string;
    receiverCurrency?: string;
    exchangeRate?: number;
    receiverAmount?: number;
    fees: number;
    status: string;
    createdAt: string;
    notes?: string;
    editedAt?: string;
    editedByBranch?: { id: number; name: string; branchCode: string };
    editReason?: string;
    allowPartialPayment?: boolean;
    totalReceived?: number;
    receivedCurrency?: string;
    totalPaid?: number;
    remainingBalance?: number;
    paymentStatus?: 'SINGLE' | 'OPEN' | 'PARTIAL' | 'FULLY_PAID';
}

interface PendingPickupsResponse {
    data: PendingPickup[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export default function PendingPickupsPage() {
    const { user } = useAuth();
    const { isConnected } = useWebSocket();
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [selectedPickup, setSelectedPickup] = useState<PendingPickup | null>(null);
    const [editingPickup, setEditingPickup] = useState<PickupTransaction | null>(null);
    const [paymentTransaction, setPaymentTransaction] = useState<PickupTransaction | null>(null);
    const [showPaymentsDialog, setShowPaymentsDialog] = useState(false);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const markAsPickedUpMutation = useMarkAsPickedUp();
    const [searchQuery, setSearchQuery] = useState('');



    const { data: pickupsResponse, isLoading, refetch } = useQuery<PendingPickupsResponse>({
        queryKey: ['all-pickups', startDate, endDate, statusFilter],
        queryFn: async () => {
            const params: Record<string, string | number> = { page: 1, limit: 100 };
            if (startDate) params.dateFrom = startDate;
            if (endDate) params.dateTo = endDate;
            if (statusFilter !== 'ALL') params.status = statusFilter;

            const response = await apiClient.get('/pickups', { params });
            return response.data;
        }
    });

    const pickups = pickupsResponse?.data ?? [];

    const filteredPickups = pickups.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (p.pickupCode?.toLowerCase().includes(q)) ||
            (p.senderName?.toLowerCase().includes(q)) ||
            (p.recipientName?.toLowerCase().includes(q)) ||
            (p.amount?.toString().includes(q))
        );
    });

    // Handle pickup updates via WebSocket
    const handlePickupUpdate = useCallback((message: WSMessage) => {
        const pickupCode = (message.data as { pickupCode?: string }).pickupCode || 'New';
        console.log('Pickup update:', message);
        toast.info(`Pickup ${message.action}: ${pickupCode}`, {
            description: 'Pickup data has been updated',
        });
        // Refresh pickup list
        refetch();
    }, [refetch]);

    // Subscribe to pickup updates
    usePickupUpdates(handlePickupUpdate);

    const handleVerifyClick = (pickup: PendingPickup) => {
        setSelectedPickup(pickup);
        setShowVerifyDialog(true);
    };

    const handleEditClick = (pickup: PendingPickup) => {
        setEditingPickup(pickup as PickupTransaction);
        setShowEditDialog(true);
    };

    const handlePaymentsClick = (pickup: PendingPickup) => {
        setPaymentTransaction(pickup as PickupTransaction);
        setShowPaymentsDialog(true);
    };

    const handleConfirmVerify = async () => {
        if (!selectedPickup) return;

        try {
            await markAsPickedUpMutation.mutateAsync(selectedPickup.id);
            toast.success('Transaction verified successfully');
            setShowVerifyDialog(false);
            setSelectedPickup(null);
            refetch();
        } catch {
            toast.error('Failed to verify transaction');
        }
    };

    const toExportTransaction = (pickup: PendingPickup): ExportTransaction => ({
        pickupCode: pickup.pickupCode || pickup.controlNumber || '',
        transactionType: 'PICKUP',
        senderName: pickup.senderName,
        senderPhone: pickup.senderPhone,
        recipientName: pickup.recipientName,
        recipientPhone: pickup.recipientPhone,
        amount: pickup.amount,
        currency: pickup.currency,
        receiverCurrency: pickup.receiverCurrency,
        exchangeRate: pickup.exchangeRate,
        receiverAmount: pickup.receiverAmount,
        fees: pickup.fees,
        status: pickup.status,
        createdAt: pickup.createdAt,
        notes: pickup.notes,
    });

    const handleEditSuccess = () => {
        refetch();
    };

    const formatMoney = (value: number, currency: string) =>
        `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

    const formatRate = (value?: number) => (value === undefined || value === null ? '1.0000' : value.toFixed(4));

    const handlePrintReceipt = async (pickup: PendingPickup) => {
        try {
            const response = await apiClient.get(`/receipts/pickup/${pickup.id}/pdf`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus();
                    printWindow.print();
                };
            } else {
                const link = document.createElement('a');
                link.href = url;
                link.download = `pickup_receipt_${pickup.pickupCode || pickup.controlNumber || pickup.id}.pdf`;
                link.click();
            }

            window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch {
            toast.error('Failed to print receipt');
        }
    };

    const getStatusMeta = (status: string) => {
        switch (status) {
            case 'PENDING':
                return {
                    label: 'Pending Pickup',
                    bar: 'bg-amber-500',
                    badge: 'border-amber-200 bg-amber-50 text-amber-700',
                };
            case 'PICKED_UP':
            case 'COMPLETED':
                return {
                    label: 'Completed',
                    bar: 'bg-emerald-500',
                    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                };
            case 'CANCELLED':
                return {
                    label: 'Cancelled',
                    bar: 'bg-rose-500',
                    badge: 'border-rose-200 bg-rose-50 text-rose-700',
                };
            default:
                return {
                    label: status,
                    bar: 'bg-slate-300',
                    badge: 'border-slate-200 bg-slate-50 text-slate-600',
                };
        }
    };

    if (user?.role === 'superadmin') {
        return (
            <div className="container mx-auto px-6 py-8">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Access restricted for SuperAdmin</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <main className="container max-w-[1000px] mx-auto px-6 py-10">
            {/* Page Header */}
            <header className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Orders</h1>
                    <p className="text-[15px] text-slate-500">Track and manage money transfers across all branches.</p>
                </div>
                <div className="bg-white border border-slate-200 shadow-sm rounded-full px-4 py-1.5 text-xs font-bold text-slate-500 flex items-center gap-2.5">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                    Live Updates
                </div>
            </header>

            {/* Filters Bar */}
            <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative min-w-[200px] w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search orders (e.g. O-8494, Name)..."
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-600 transition-colors placeholder:text-slate-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-blue-600 transition-colors"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-blue-600 transition-colors"
                    />
                </div>

                <div className="w-full md:w-[150px]">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-[42px] border-slate-200 rounded-lg text-sm">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="PICKED_UP">Completed</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer h-[42px]">
                            <Download className="w-4 h-4" />
                            Export
                            <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => exportToCSV(filteredPickups.map(toExportTransaction), 'transactions')}>
                            <FileText className="mr-2 h-4 w-4" /> CSV Export
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToExcel(filteredPickups.map(toExportTransaction), 'transactions')}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel Export
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToPDF(filteredPickups.map(toExportTransaction), 'transactions')}>
                            <Printer className="mr-2 h-4 w-4" /> PDF Export
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </section>

            {/* Orders List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : filteredPickups.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                    <Package className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 font-medium">No orders found matching your criteria</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredPickups.map((pickup) => {
                        const statusMeta = getStatusMeta(pickup.status);
                        const pickupCode = pickup.pickupCode || pickup.controlNumber || 'N/A';
                        const hasConversion = Boolean(pickup.receiverCurrency && pickup.receiverCurrency !== pickup.currency);
                        const exchangeRate = pickup.exchangeRate ?? 1;
                        const fees = pickup.fees ?? 0;
                        const pickupAmount = hasConversion
                            ? pickup.receiverAmount ?? pickup.amount * exchangeRate
                            : pickup.amount;
                        const pickupCurrency = hasConversion
                            ? pickup.receiverCurrency || pickup.currency
                            : pickup.currency;

                        return (
                            <article key={pickup.id} className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:-translate-y-[2px] transition-all duration-200 overflow-hidden group">
                                {/* Card Top */}
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-bold text-slate-900">#{pickupCode}</span>
                                        <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {format(new Date(pickup.createdAt), 'MMM dd, yyyy • HH:mm')}
                                        </span>
                                    </div>
                                    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${statusMeta.badge}`}>
                                        {statusMeta.label}
                                    </div>
                                </div>

                                {/* Card Content */}
                                <div className="p-6 grid md:grid-cols-[1.5fr_1fr] gap-8">
                                    {/* Route Info */}
                                    <div className="relative flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] md:items-center gap-6 md:gap-0">
                                        {/* Dashed line background */}
                                        <div
                                            className="absolute left-[20px] right-[20px] top-1/2 -translate-y-1/2 hidden h-[2px] md:block"
                                            style={{
                                                backgroundImage: 'linear-gradient(to right, #e2e8f0 60%, transparent 40%)',
                                                backgroundSize: '10px 1px',
                                                backgroundRepeat: 'repeat-x',
                                            }}
                                        />

                                        <div className="relative z-10 flex flex-col gap-1 items-start">
                                            <div className="bg-white pr-4">
                                                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">Sender</span>
                                                <span className="text-base font-bold text-slate-900 block truncate" title={pickup.senderName}>{pickup.senderName}</span>
                                                {pickup.senderPhone && <span className="text-[13px] text-slate-500 block truncate">Tel: {pickup.senderPhone}</span>}
                                                <span className="mt-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded inline-flex items-center w-fit">
                                                    <MapPin className="w-3 h-3 mr-1" /> {pickup.senderBranch?.name}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 border border-slate-200 shadow-sm text-slate-400 mx-auto">
                                            <ArrowRight className="w-5 h-5 text-slate-500 md:rotate-0 rotate-90" />
                                        </div>

                                        <div className="relative z-10 flex flex-col gap-1 md:items-end md:text-right">
                                            <div className="bg-white pl-4 flex flex-col md:items-end">
                                                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">Receiver</span>
                                                <span className="text-base font-bold text-slate-900 block truncate" title={pickup.recipientName}>{pickup.recipientName}</span>
                                                {pickup.recipientPhone && <span className="text-[13px] text-slate-500 block truncate">Tel: {pickup.recipientPhone}</span>}
                                                <span className="mt-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded inline-flex items-center w-fit">
                                                    <MapPin className="w-3 h-3 mr-1" /> {pickup.receiverBranch?.name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financials highlight */}
                                    <div className="flex flex-col gap-2 md:pl-8 md:border-l border-slate-100">
                                        <div className="flex justify-between text-[13px] text-slate-500">
                                            <span>Send Amount</span>
                                            <span className="font-semibold text-slate-900">{formatMoney(pickup.amount, pickup.currency)}</span>
                                        </div>
                                        <div className="flex justify-between text-[13px] text-slate-500">
                                            <span>Rate</span>
                                            <span className="font-mono">{formatRate(pickup.exchangeRate)}</span>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between p-3 bg-emerald-50 rounded-lg text-emerald-800 border border-emerald-100">
                                            <span className="text-[11px] font-bold uppercase tracking-wide">Pickup</span>
                                            <span className="text-base font-extrabold">{formatMoney(pickupAmount, pickupCurrency)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <button
                                        onClick={() => handlePrintReceipt(pickup)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Print Receipt
                                    </button>

                                    {pickup.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleEditClick(pickup)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                                Edit
                                            </button>

                                            <button
                                                onClick={() => handleVerifyClick(pickup)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 border border-blue-600 rounded-md text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Process Pickup
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Verify Confirmation Dialog */}
            <AlertDialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verify Transaction</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to mark this pickup as verified and given?
                        </AlertDialogDescription>
                        {selectedPickup && (
                            <div className="mt-4 p-3 bg-muted rounded-md space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Code:</span>
                                    <span className="font-mono font-bold">{selectedPickup.pickupCode || selectedPickup.controlNumber || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Recipient:</span>
                                    <span className="font-medium">{selectedPickup.recipientName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Amount:</span>
                                    <span className="font-bold">
                                        {selectedPickup.receiverAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || selectedPickup.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedPickup.receiverCurrency || selectedPickup.currency}
                                    </span>
                                </div>
                            </div>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmVerify}>
                            Verify & Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Transaction Dialog */}
            <EditPickupDialog
                transaction={editingPickup}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                onSuccess={handleEditSuccess}
            />

            {/* Manage Payments Dialog */}
            <ManagePaymentsDialog
                transaction={paymentTransaction}
                open={showPaymentsDialog}
                onOpenChange={setShowPaymentsDialog}
            />
        </main>
    );
}
