import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/transactions - Fetch all transactions (optionally filtered by clientId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const transactions = await prisma.transaction.findMany({
      where: clientId ? { clientId } : undefined,
      include: {
        client: true,
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    // Map database fields to frontend expected format
    const formattedTransactions = transactions.map(tx => ({
      transactionId: tx.id,
      clientId: tx.clientId,
      date: tx.transactionDate.toISOString(),
      type: tx.type,
      sendCurrency: tx.sendCurrency,
      sendAmount: tx.sendAmount,
      receiveCurrency: tx.receiveCurrency,
      receiveAmount: tx.receiveAmount,
      rateApplied: tx.rateApplied,
      feeCharged: tx.feeCharged,
      beneficiaryName: tx.beneficiaryName || '',
      beneficiaryDetails: tx.beneficiaryDetails || '',
      userNotes: tx.userNotes || '',
      isEdited: tx.isEdited,
      lastEditedAt: tx.lastEditedAt?.toISOString(),
      editHistory: tx.editHistory ? JSON.parse(tx.editHistory) : [],
    }));

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
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

    if (!clientId || !type || !sendCurrency || !sendAmount || !receiveCurrency || !receiveAmount || !rateApplied) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['CASH_EXCHANGE', 'BANK_TRANSFER'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "CASH_EXCHANGE" or "BANK_TRANSFER"' },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        clientId,
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
      },
      include: {
        client: true,
      },
    });

    // Format response to match frontend expectations
    const formattedTransaction = {
      transactionId: transaction.id,
      clientId: transaction.clientId,
      date: transaction.transactionDate.toISOString(),
      type: transaction.type,
      sendCurrency: transaction.sendCurrency,
      sendAmount: transaction.sendAmount,
      receiveCurrency: transaction.receiveCurrency,
      receiveAmount: transaction.receiveAmount,
      rateApplied: transaction.rateApplied,
      feeCharged: transaction.feeCharged,
      beneficiaryName: transaction.beneficiaryName || '',
      beneficiaryDetails: transaction.beneficiaryDetails || '',
      userNotes: transaction.userNotes || '',
      isEdited: transaction.isEdited,
      lastEditedAt: transaction.lastEditedAt?.toISOString(),
      editHistory: [],
    };

    return NextResponse.json(formattedTransaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
