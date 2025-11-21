'use client';

import { Payment, PAYMENT_STATUS_LABELS } from '@/src/lib/models/payment.model';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { 
    Calendar, 
    CreditCard, 
    DollarSign, 
    FileText, 
    MapPin, 
    User,
    Edit,
    XCircle,
    AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';

interface PaymentCardProps {
    payment: Payment;
    onEdit?: (payment: Payment) => void;
    onCancel?: (payment: Payment) => void;
    showActions?: boolean;
}

export function PaymentCard({ payment, onEdit, onCancel, showActions = true }: PaymentCardProps) {
    const statusInfo = PAYMENT_STATUS_LABELS[payment.status];
    const isCancelled = payment.status === 'CANCELLED';
    const isEdited = payment.isEdited;

    return (
        <Card className={`${isCancelled ? 'opacity-60 border-gray-300' : ''}`}>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-lg">
                                    {payment.amount.toLocaleString()} {payment.currency}
                                </h4>
                                <Badge variant={statusInfo.color as any}>
                                    {statusInfo.label}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Payment #{payment.id}
                            </p>
                        </div>
                    </div>
                    
                    {showActions && !isCancelled && (
                        <div className="flex gap-2">
                            {onEdit && (
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onEdit(payment)}
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                            )}
                            {onCancel && (
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onCancel(payment)}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <XCircle className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="w-4 h-4" />
                        <span>{payment.paymentMethod.replace('_', ' ')}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(payment.paidAt), 'MMM dd, yyyy HH:mm')}</span>
                    </div>

                    {payment.branch && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{payment.branch.name}</span>
                        </div>
                    )}

                    {payment.paidByUser && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span>{payment.paidByUser.email}</span>
                        </div>
                    )}
                </div>

                {payment.exchangeRate !== 1 && (
                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Exchange Rate:</span>
                            <span className="font-medium">1 {payment.currency} = {payment.exchangeRate.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-muted-foreground">Amount in Base:</span>
                            <span className="font-medium">{payment.amountInBase.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {payment.notes && (
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                        <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <span>{payment.notes}</span>
                        </div>
                    </div>
                )}

                {payment.receiptNumber && (
                    <div className="mt-2 text-sm text-muted-foreground">
                        Receipt: <span className="font-mono">{payment.receiptNumber}</span>
                    </div>
                )}

                {isEdited && payment.editedAt && (
                    <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                            <Edit className="w-4 h-4 text-amber-600 mt-0.5" />
                            <div className="flex-1">
                                <div className="font-medium text-amber-900 dark:text-amber-100">
                                    Edited on {format(new Date(payment.editedAt), 'MMM dd, yyyy HH:mm')}
                                </div>
                                {payment.editReason && (
                                    <div className="text-amber-700 dark:text-amber-300 mt-1">
                                        Reason: {payment.editReason}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isCancelled && payment.cancelledAt && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 rounded text-sm border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                            <div className="flex-1">
                                <div className="font-medium text-red-900 dark:text-red-100">
                                    Cancelled on {format(new Date(payment.cancelledAt), 'MMM dd, yyyy HH:mm')}
                                </div>
                                {payment.cancelReason && (
                                    <div className="text-red-700 dark:text-red-300 mt-1">
                                        Reason: {payment.cancelReason}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
