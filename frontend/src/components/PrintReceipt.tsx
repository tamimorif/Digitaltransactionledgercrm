import { formatCurrency } from '@/src/lib/format';
import { format } from 'date-fns';

interface PrintReceiptProps {
    transaction: {
        pickupCode: string;
        transactionType: string;
        senderName: string;
        senderPhone: string;
        recipientName: string;
        recipientPhone?: string;
        amount: number;
        currency: string;
        receiverCurrency?: string;
        exchangeRate?: number;
        receiverAmount?: number;
        fees: number;
        status: string;
        createdAt: string;
        notes?: string;
        senderBranch?: { name: string; branchCode: string };
        receiverBranch?: { name: string; branchCode: string };
    };
    companyName?: string;
}

export function PrintReceipt({ transaction, companyName = 'Digital Transaction Ledger' }: PrintReceiptProps) {
    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'CASH_PICKUP': return 'Walk-In Exchange';
            case 'CARD_SWAP_IRR': return 'Card Cash-Out';
            case 'CASH_EXCHANGE': return 'Branch Transfer';
            case 'BANK_TRANSFER': return 'Bank Transfer';
            default: return type;
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="receipt-container">
            <style jsx>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .receipt-container, .receipt-container * {
                        visibility: visible;
                    }
                    .receipt-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none;
                    }
                }
            `}</style>

            <div className="max-w-2xl mx-auto p-8 border-2 border-dashed border-gray-300">
                {/* Header */}
                <div className="text-center mb-6 border-b-2 border-black pb-4">
                    <h1 className="text-3xl font-bold mb-2">{companyName}</h1>
                    <p className="text-lg font-semibold">Transaction Receipt</p>
                    <p className="text-sm text-gray-600">Official Copy</p>
                </div>

                {/* Transaction Code */}
                <div className="bg-gray-100 p-4 rounded-lg text-center mb-6">
                    <p className="text-xs text-gray-600 mb-1">Transaction Code</p>
                    <p className="text-3xl font-bold tracking-wider font-mono">{transaction.pickupCode}</p>
                </div>

                {/* Transaction Details */}
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-600">Transaction Type</p>
                            <p className="font-semibold">{getTypeLabel(transaction.transactionType)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Status</p>
                            <p className="font-semibold uppercase">{transaction.status}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Date & Time</p>
                            <p className="font-semibold">{format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Branch</p>
                            <p className="font-semibold">{transaction.senderBranch?.name || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Sender/Customer Info */}
                <div className="border-t border-gray-300 pt-4 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Customer Information</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-600">Name</p>
                            <p className="font-medium">{transaction.senderName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Phone</p>
                            <p className="font-medium">{transaction.senderPhone}</p>
                        </div>
                    </div>
                </div>

                {/* Recipient Info (if different) */}
                {transaction.recipientName !== transaction.senderName && (
                    <div className="border-t border-gray-300 pt-4 mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Recipient Information</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-600">Name</p>
                                <p className="font-medium">{transaction.recipientName}</p>
                            </div>
                            {transaction.recipientPhone && (
                                <div>
                                    <p className="text-xs text-gray-600">Phone</p>
                                    <p className="font-medium">{transaction.recipientPhone}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Amount Details */}
                <div className="border-t-2 border-black pt-4 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Transaction Amount</p>
                    <div className="space-y-2">
                        <div className="flex justify-between text-lg">
                            <span>Amount:</span>
                            <span className="font-bold">{formatCurrency(transaction.amount)} {transaction.currency}</span>
                        </div>

                        {transaction.exchangeRate && transaction.exchangeRate !== 1 && (
                            <>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Exchange Rate:</span>
                                    <span>1 {transaction.currency} = {transaction.exchangeRate} {transaction.receiverCurrency}</span>
                                </div>
                                <div className="flex justify-between text-lg">
                                    <span>Receives:</span>
                                    <span className="font-bold text-green-600">
                                        {formatCurrency(transaction.receiverAmount || 0)} {transaction.receiverCurrency}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between text-sm">
                            <span>Transaction Fee:</span>
                            <span className="font-medium">{formatCurrency(transaction.fees)} {transaction.currency}</span>
                        </div>

                        <div className="border-t border-gray-300 pt-2 mt-2">
                            <div className="flex justify-between text-xl">
                                <span className="font-bold">Total:</span>
                                <span className="font-bold">
                                    {formatCurrency(transaction.amount + transaction.fees)} {transaction.currency}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {transaction.notes && (
                    <div className="border-t border-gray-300 pt-4 mb-4">
                        <p className="text-xs text-gray-600 mb-1">Notes</p>
                        <p className="text-sm">{transaction.notes}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="border-t-2 border-black pt-4 mt-6 text-center text-xs text-gray-600 space-y-1">
                    <p>This is an official receipt for your transaction</p>
                    <p>Keep this receipt for your records</p>
                    <p className="font-medium">Thank you for your business!</p>
                </div>

                {/* Print Button */}
                <div className="mt-6 text-center no-print">
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );
}
