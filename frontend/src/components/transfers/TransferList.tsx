import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import { Loader2, ArrowRightLeft, Check, X, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '@/src/lib/format';
import { useGetTransfers, useAcceptTransfer, useCancelTransfer } from '@/src/lib/queries/transfer.query';
import { useAuth } from '@/src/components/providers/auth-provider';
import { CreateTransferDialog } from './CreateTransferDialog';
import { toast } from 'sonner';

export function TransferList() {
    const { user } = useAuth();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const { data: transfers, isLoading } = useGetTransfers(
        undefined, // branchId (optional, maybe filter by user's branch if needed)
        statusFilter === 'all' ? undefined : statusFilter
    );

    const acceptMutation = useAcceptTransfer();
    const cancelMutation = useCancelTransfer();

    const handleAccept = async (id: number) => {
        try {
            await acceptMutation.mutateAsync(id);
            toast.success('Transfer accepted');
        } catch {
            toast.error('Failed to accept transfer');
        }
    };

    const handleCancel = async (id: number) => {
        try {
            await cancelMutation.mutateAsync(id);
            toast.success('Transfer cancelled');
        } catch {
            toast.error('Failed to cancel transfer');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
            case 'COMPLETED':
                return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
            case 'CANCELLED':
                return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5" />
                            Inter-Branch Transfers
                        </CardTitle>
                        <CardDescription>Manage fund transfers between branches</CardDescription>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Transfer
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 mb-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : !transfers || transfers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No transfers found
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transfers.map((transfer) => (
                                    <TableRow key={transfer.id}>
                                        <TableCell>{formatDate(transfer.createdAt)}</TableCell>
                                        <TableCell>{transfer.sourceBranch?.name}</TableCell>
                                        <TableCell>{transfer.destinationBranch?.name}</TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(transfer.amount, transfer.currency)}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                                        <TableCell className="text-right">
                                            {transfer.status === 'PENDING' && (
                                                <div className="flex justify-end gap-2">
                                                    {/* Only destination branch can accept */}
                                                    {user?.primaryBranchId === transfer.destinationBranchId && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            onClick={() => handleAccept(transfer.id)}
                                                            title="Accept Transfer"
                                                            disabled={acceptMutation.isPending}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {/* Only source branch (creator) can cancel */}
                                                    {user?.primaryBranchId === transfer.sourceBranchId && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleCancel(transfer.id)}
                                                            title="Cancel Transfer"
                                                            disabled={cancelMutation.isPending}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <CreateTransferDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </Card>
    );
}
