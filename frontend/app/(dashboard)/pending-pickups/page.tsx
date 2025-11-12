'use client';

import { useState } from 'react';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Loader2, Package, ArrowRight, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMarkAsPickedUp } from '@/src/lib/queries/pickup.query';

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
}

export default function PendingPickupsPage() {
    const { user } = useAuth();
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [selectedPickup, setSelectedPickup] = useState<PendingPickup | null>(null);
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

    const handleVerifyClick = (pickup: PendingPickup) => {
        setSelectedPickup(pickup);
        setShowVerifyDialog(true);
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
            <div>
                <h1 className="text-3xl font-bold">Orders</h1>
                <p className="text-muted-foreground">All money transfer orders across all branches</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Transactions</CardTitle>
                    <CardDescription>
                        {pickups.length} pending pickup{pickups.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                            {pickups.map((pickup) => (
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
                                                            {pickup.amount.toFixed(2)} {pickup.currency}
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
                                                                    {pickup.receiverAmount?.toFixed(2)} {pickup.receiverCurrency}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="flex items-center justify-between text-sm border-t pt-2">
                                                        <span className="text-muted-foreground">Fees</span>
                                                        <span className="font-medium">{pickup.fees.toFixed(2)} {pickup.currency}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between border-t pt-2">
                                                        <span className="text-sm font-medium">Total Cost</span>
                                                        <span className="text-lg font-bold">
                                                            {(pickup.amount + pickup.fees).toFixed(2)} {pickup.currency}
                                                        </span>
                                                    </div>
                                                </div>

                                                {pickup.notes && (
                                                    <div className="text-sm">
                                                        <p className="text-muted-foreground mb-1">Notes:</p>
                                                        <p className="italic">{pickup.notes}</p>
                                                    </div>
                                                )}

                                                {/* Verify Button for Pending Orders */}
                                                {pickup.status === 'PENDING' && (
                                                    <Button
                                                        onClick={() => handleVerifyClick(pickup)}
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
                                            {selectedPickup.receiverAmount?.toFixed(2) || selectedPickup.amount.toFixed(2)} {selectedPickup.receiverCurrency || selectedPickup.currency}
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
        </div>
    );
}
