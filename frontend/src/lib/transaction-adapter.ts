import type { Transaction } from './models/client.model';
import type { Payment } from './models/payment.model';
import type { PickupTransaction } from './models/pickup.model';

export const toPaymentTransaction = (pickup: PickupTransaction): Transaction => {
    const payments = Array.isArray(pickup.payments) ? (pickup.payments as Payment[]) : undefined;
    const receiveCurrency = pickup.receiverCurrency ?? pickup.receivedCurrency ?? pickup.currency;
    const receiveAmount = pickup.receiverAmount ?? pickup.totalReceived ?? pickup.amount;

    return {
        id: pickup.transactionId ?? pickup.id.toString(),
        clientId: pickup.senderPhone,
        tenantId: pickup.tenantId,
        type: 'MONEY_PICKUP',
        sendCurrency: pickup.currency,
        sendAmount: pickup.amount,
        receiveCurrency,
        receiveAmount,
        rateApplied: pickup.exchangeRate ?? 0,
        feeCharged: pickup.fees ?? 0,
        beneficiaryName: pickup.recipientName,
        beneficiaryDetails: pickup.recipientIban,
        userNotes: pickup.notes,
        transactionDate: pickup.createdAt,
        createdAt: pickup.createdAt,
        updatedAt: pickup.updatedAt,
        branch: pickup.receiverBranch
            ? { id: pickup.receiverBranch.id, name: pickup.receiverBranch.name }
            : pickup.senderBranch
                ? { id: pickup.senderBranch.id, name: pickup.senderBranch.name }
                : undefined,
        totalReceived: pickup.totalReceived,
        receivedCurrency: pickup.receivedCurrency ?? pickup.receiverCurrency ?? pickup.currency,
        totalPaid: pickup.totalPaid,
        remainingBalance: pickup.remainingBalance,
        paymentStatus: pickup.paymentStatus,
        allowPartialPayment: pickup.allowPartialPayment,
        payments,
    };
};
