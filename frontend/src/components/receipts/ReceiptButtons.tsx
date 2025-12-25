'use client';

import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';
import { useDownloadOutgoingReceipt, useDownloadIncomingReceipt } from '@/src/lib/queries/dashboard.query';
import { FileDown, Loader2, Printer } from 'lucide-react';

interface ReceiptButtonProps {
    remittanceId: number | string;
    type: 'outgoing' | 'incoming';

    variant?: 'default' | 'outline' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showText?: boolean;
}

export function ReceiptDownloadButton({
    remittanceId,
    type,
    variant = 'outline',
    size = 'sm',
    showText = true,
}: ReceiptButtonProps) {
    const outgoingMutation = useDownloadOutgoingReceipt();
    const incomingMutation = useDownloadIncomingReceipt();

    const mutation = type === 'outgoing' ? outgoingMutation : incomingMutation;

    const handleDownload = async () => {
        try {
            await mutation.mutateAsync(remittanceId);
            toast.success('Receipt downloaded successfully');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to download receipt');
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleDownload}
            disabled={mutation.isPending}
        >
            {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <FileDown className="h-4 w-4" />
            )}
            {showText && <span className="ml-2">Receipt</span>}
        </Button>
    );
}

interface PrintReceiptButtonProps {
    remittanceId: number | string;
    type: 'outgoing' | 'incoming';

    variant?: 'default' | 'outline' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showText?: boolean;
    className?: string;
}

export function PrintReceiptButton({
    remittanceId,
    type,
    variant = 'ghost',
    size = 'icon',
    showText = false,
    className,
}: PrintReceiptButtonProps) {

    const outgoingMutation = useDownloadOutgoingReceipt();
    const incomingMutation = useDownloadIncomingReceipt();

    const mutation = type === 'outgoing' ? outgoingMutation : incomingMutation;

    const handlePrint = async () => {
        try {
            const blob = await mutation.mutateAsync(remittanceId);

            // Create a URL for the blob and open it in a new window for printing
            const url = window.URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                };
            } else {
                // Fallback: download if popup blocked
                const link = document.createElement('a');
                link.href = url;
                link.download = `${type}_receipt_${remittanceId}.pdf`;
                link.click();
            }

            // Clean up
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to print receipt');
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handlePrint}
            disabled={mutation.isPending}
            title="Print Receipt"
            className={className}
        >

            {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Printer className="h-4 w-4" />
            )}
            {showText && <span className="ml-2">Print</span>}
        </Button>
    );
}

interface ReceiptActionsProps {
    remittanceId: number | string;
    type: 'outgoing' | 'incoming';

}

export function ReceiptActions({ remittanceId, type }: ReceiptActionsProps) {
    return (
        <div className="flex items-center gap-1">
            <ReceiptDownloadButton
                remittanceId={remittanceId}
                type={type}
                variant="ghost"
                size="icon"
                showText={false}
            />
            <PrintReceiptButton
                remittanceId={remittanceId}
                type={type}
            />
        </div>
    );
}
