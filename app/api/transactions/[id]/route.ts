import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/transactions/[id] - Update a transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id;
    const body = await request.json();
    const {
      type,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      receiveAmount,
      rateApplied,
      feeCharged,
      beneficiaryName,
      beneficiaryDetails,
      userNotes,
    } = body;

    // Get the current transaction to save in edit history
    const currentTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!currentTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Prepare edit history
    const editHistory = currentTransaction.editHistory
      ? JSON.parse(currentTransaction.editHistory)
      : [];

    editHistory.push({
      editedAt: new Date().toISOString(),
      previousVersion: {
        type: currentTransaction.type,
        sendCurrency: currentTransaction.sendCurrency,
        sendAmount: currentTransaction.sendAmount,
        receiveCurrency: currentTransaction.receiveCurrency,
        receiveAmount: currentTransaction.receiveAmount,
        rateApplied: currentTransaction.rateApplied,
        feeCharged: currentTransaction.feeCharged,
        beneficiaryName: currentTransaction.beneficiaryName,
        beneficiaryDetails: currentTransaction.beneficiaryDetails,
        userNotes: currentTransaction.userNotes,
      },
    });

    // Update the transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        type,
        sendCurrency,
        sendAmount: parseFloat(sendAmount),
        receiveCurrency,
        receiveAmount: parseFloat(receiveAmount),
        rateApplied: parseFloat(rateApplied),
        feeCharged: parseFloat(feeCharged || 0),
        beneficiaryName: beneficiaryName || null,
        beneficiaryDetails: beneficiaryDetails || null,
        userNotes: userNotes || null,
        isEdited: true,
        lastEditedAt: new Date(),
        editHistory: JSON.stringify(editHistory),
      },
      include: {
        client: true,
      },
    });

    // Format response to match frontend expectations
    const formattedTransaction = {
      transactionId: updatedTransaction.id,
      clientId: updatedTransaction.clientId,
      date: updatedTransaction.transactionDate.toISOString(),
      type: updatedTransaction.type,
      sendCurrency: updatedTransaction.sendCurrency,
      sendAmount: updatedTransaction.sendAmount,
      receiveCurrency: updatedTransaction.receiveCurrency,
      receiveAmount: updatedTransaction.receiveAmount,
      rateApplied: updatedTransaction.rateApplied,
      feeCharged: updatedTransaction.feeCharged,
      beneficiaryName: updatedTransaction.beneficiaryName || '',
      beneficiaryDetails: updatedTransaction.beneficiaryDetails || '',
      userNotes: updatedTransaction.userNotes || '',
      isEdited: updatedTransaction.isEdited,
      lastEditedAt: updatedTransaction.lastEditedAt?.toISOString(),
      editHistory: editHistory,
    };

    return NextResponse.json(formattedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions/[id] - Delete a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id;

    await prisma.transaction.delete({
      where: { id: transactionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
