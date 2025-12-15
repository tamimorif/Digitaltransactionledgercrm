'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Loader2, Package, ArrowRight, Calendar, DollarSign, CheckCircle, Edit, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMarkAsPickedUp } from '@/src/lib/queries/pickup.query';
import { EditPickupDialog } from '@/src/components/EditPickupDialog';
import { ManagePaymentsDialog } from '@/src/components/ManagePaymentsDialog';
import { PickupTransaction } from '@/src/lib/models/pickup.model';
import { exportToCSV, exportToExcel, exportToPDF } from '@/src/lib/export';
import { LiveIndicator } from '@/src/components/LiveIndicator';
import { useWebSocket, usePickupUpdates } from '@/src/hooks/useWebSocket';


interface PendingPickup {
    id: number;
    pickupCode: string;
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

    const { data: pickups = [], isLoading, refetch } = useQuery<PendingPickup[]>({
        queryKey: ['all-pickups'],
        queryFn: async () => {
            const token = localStorage.getItem('auth_token');
            // Fetch all pickups (pending, completed, cancelled)
            const response = await axios.get('http://localhost:8080/api/pickups', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data.data || [];
        }
    });

    // Handle pickup updates via WebSocket
    const handlePickupUpdate = useCallback((message: any) => {
        console.log('Pickup update:', message);
        toast.info(`Pickup ${message.action}: ${message.data.pickupCode || 'New'}`, {
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
        } catch (error) {
            toast.error('Failed to verify transaction');
        }
    };

    const handleEditSuccess = () => {
        refetch();
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
        <div className="container mx-auto px-6 py-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Orders</h1>
                    <p className="text-muted-foreground">All money transfer orders across all branches</p>
                </div>
                <LiveIndicator isConnected={isConnected} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>All Transactions</CardTitle>
                            <CardDescription>
                                {(() => {
                                    const filtered = pickups.filter(p => {
                                        const matchesDate = (!startDate || new Date(p.createdAt) >= new Date(startDate)) &&
                                            (!endDate || new Date(p.createdAt) <= new Date(endDate + 'T23:59:59'));
                                        const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
                                        return matchesDate && matchesStatus;
                                    });
                                    return `${filtered.length} of ${pickups.length} transaction${filtered.length !== 1 ? 's' : ''}`;
                                })()}
                            </CardDescription>
                        </div>
                        {pickups.length > 0 && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const filtered = pickups.filter(p => {
                                            const matchesDate = (!startDate || new Date(p.createdAt) >= new Date(startDate)) &&
                                                (!endDate || new Date(p.createdAt) <= new Date(endDate + 'T23:59:59'));
                                            const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
                                            return matchesDate && matchesStatus;
                                        });
                                        exportToCSV(filtered as any, 'transactions');
                                        toast.success(`Exported ${filtered.length} transactions to CSV`);
                                    }}
                                >
                                    <FileText className="h-4 w-4 mr-2" />
                                    CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const filtered = pickups.filter(p => {
                                            const matchesDate = (!startDate || new Date(p.createdAt) >= new Date(startDate)) &&
                                                (!endDate || new Date(p.createdAt) <= new Date(endDate + 'T23:59:59'));
                                            const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
                                            return matchesDate && matchesStatus;
                                        });
                                        exportToExcel(filtered as any, 'transactions');
                                        toast.success(`Exported ${filtered.length} transactions to Excel`);
                                    }}
                                >
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Excel
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const filtered = pickups.filter(p => {
                                            const matchesDate = (!startDate || new Date(p.createdAt) >= new Date(startDate)) &&
                                                (!endDate || new Date(p.createdAt) <= new Date(endDate + 'T23:59:59'));
                                            const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
                                            return matchesDate && matchesStatus;
                                        });
                                        exportToPDF(filtered as any, 'transactions');
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    PDF
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Date and Status Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">From Date</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">To Date</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="statusFilter">Status Filter</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger id="statusFilter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Statuses</SelectItem>
                                    <SelectItem value="PENDING">Pending Only</SelectItem>
                                    <SelectItem value="PICKED_UP">Completed Only</SelectItem>
                                    <SelectItem value="COMPLETED">Completed Only</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : pickups.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No orders yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pickups
                                .filter(pickup => {
                                    const matchesDate = (!startDate || new Date(pickup.createdAt) >= new Date(startDate)) &&
                                        (!endDate || new Date(pickup.createdAt) <= new Date(endDate + 'T23:59:59'));
                                    const matchesStatus = statusFilter === 'ALL' || pickup.status === statusFilter;
                                    return matchesDate && matchesStatus;
                                })
                                .map((pickup) => (
                                    <Card key={pickup.id} className={`border-l-4 ${pickup.status === 'PENDING' ? 'border-l-yellow-500' :
                                        pickup.status === 'COMPLETED' || pickup.status === 'PICKED_UP' ? 'border-l-green-500' :
                                            'border-l-red-500'
                                        }`}>
                                        <CardContent className="pt-6">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                {/* Left Side - Transaction Details */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h3 className="text-lg font-bold font-mono text-primary">
                                                                {pickup.pickupCode}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {format(new Date(pickup.createdAt), 'MMM dd, yyyy HH:mm')}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <Badge
                                                                variant="secondary"
                                                                className={
                                                                    pickup.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                                        pickup.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                                            pickup.status === 'PICKED_UP' ? 'bg-blue-100 text-blue-800' :
                                                                                'bg-red-100 text-red-800'
                                                                }
                                                            >
                                                                {pickup.status === 'PENDING' ? 'Pending' :
                                                                    pickup.status === 'COMPLETED' || pickup.status === 'PICKED_UP' ? 'Verified & Given' :
                                                                        'Cancelled'}
                                                            </Badge>
                                                            {pickup.allowPartialPayment && pickup.paymentStatus && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={
                                                                        pickup.paymentStatus === 'FULLY_PAID' ? 'bg-green-50 text-green-700 border-green-300' :
                                                                            pickup.paymentStatus === 'PARTIAL' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                                                                'bg-orange-50 text-orange-700 border-orange-300'
                                                                    }
                                                                >
                                                                    💳 {pickup.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' :
                                                                        pickup.paymentStatus === 'PARTIAL' ? `Partial (${pickup.totalPaid?.toFixed(0)}/${pickup.totalReceived?.toFixed(0)})` :
                                                                            'Payment Pending'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1">
                                                                <p className="text-xs text-muted-foreground">From</p>
                                                                <p className="font-medium">{pickup.senderName}</p>
                                                                <p className="text-sm text-muted-foreground">{pickup.senderPhone}</p>
                                                            </div>
                                                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                                            <div className="flex-1">
                                                                <p className="text-xs text-muted-foreground">To</p>
                                                                <p className="font-medium">{pickup.recipientName}</p>
                                                                <p className="text-sm text-muted-foreground">{pickup.recipientPhone}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Branch Information */}
                                                    <div className="pt-2 border-t">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Sender Branch</p>
                                                                <p className="font-medium">{pickup.senderBranch.name}</p>
                                                                <p className="text-xs text-muted-foreground font-mono">{pickup.senderBranch.branchCode}</p>
                                                            </div>
                                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                            <div className="text-right">
                                                                <p className="text-xs text-muted-foreground">Receiver Branch</p>
                                                                <p className="font-medium">{pickup.receiverBranch.name}</p>
                                                                <p className="text-xs text-muted-foreground font-mono">{pickup.receiverBranch.branchCode}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Side - Amount Details */}
                                                <div className="space-y-4">
                                                    <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-muted-foreground">Send Amount</span>
                                                            <span className="text-xl font-bold">
                                                                {pickup.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pickup.currency}
                                                            </span>
                                                        </div>

                                                        {pickup.receiverCurrency && pickup.receiverCurrency !== pickup.currency && (
                                                            <>
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-muted-foreground">Exchange Rate</span>
                                                                    <span className="font-mono">
                                                                        1 {pickup.currency} = {pickup.exchangeRate?.toFixed(4)} {pickup.receiverCurrency}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between border-t pt-2">
                                                                    <span className="text-sm text-muted-foreground">Receive Amount</span>
                                                                    <span className="text-xl font-bold text-green-600">
                                                                        {pickup.receiverAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pickup.receiverCurrency}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}

                                                        <div className="flex items-center justify-between text-sm border-t pt-2">
                                                            <span className="text-muted-foreground">Fees</span>
                                                            <span className="font-medium">{pickup.fees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pickup.currency}</span>
                                                        </div>

                                                        <div className="flex items-center justify-between border-t pt-2">
                                                            <span className="text-sm font-medium">Total Cost</span>
                                                            <span className="text-lg font-bold">
                                                                {(pickup.amount + pickup.fees).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pickup.currency}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {pickup.notes && (
                                                        <div className="text-sm">
                                                            <p className="text-muted-foreground mb-1">Notes:</p>
                                                            <p className="italic">{pickup.notes}</p>
                                                        </div>
                                                    )}

                                                    {/* Edit History */}
                                                    {pickup.editedAt && pickup.editedByBranch && (
                                                        <div className="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 space-y-1">
                                                            <p className="font-semibold text-amber-900 dark:text-amber-200">Last Edited</p>
                                                            <p className="text-amber-800 dark:text-amber-300">
                                                                Branch: <span className="font-medium">{pickup.editedByBranch.name}</span>
                                                            </p>
                                                            <p className="text-amber-700 dark:text-amber-400">
                                                                {format(new Date(pickup.editedAt), 'MMM dd, yyyy HH:mm')}
                                                            </p>
                                                            {pickup.editReason && (
                                                                <p className="text-amber-700 dark:text-amber-400 italic">
                                                                    Reason: {pickup.editReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Action Buttons for Pending Orders */}
                                                    {pickup.status === 'PENDING' && (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                onClick={() => handleEditClick(pickup)}
                                                                className="flex-1"
                                                                variant="outline"
                                                            >
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            {pickup.allowPartialPayment && (
                                                                <Button
                                                                    onClick={() => handlePaymentsClick(pickup)}
                                                                    className="flex-1"
                                                                    variant="outline"
                                                                >
                                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                                    Payments
                                                                </Button>
                                                            )}
                                                            <Button
                                                                onClick={() => handleVerifyClick(pickup)}
                                                                className="flex-1"
                                                                variant="default"
                                                            >
                                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                                Verify
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Verify Confirmation Dialog */}
            <AlertDialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verify Transaction</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to mark this pickup as verified and given?
                            {selectedPickup && (
                                <div className="mt-4 p-3 bg-muted rounded-md space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Code:</span>
                                        <span className="font-mono font-bold">{selectedPickup.pickupCode}</span>
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
                        </AlertDialogDescription>
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
        </div>
    );
}
