'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { ArrowRight, Calculator } from 'lucide-react';

interface Transaction {
  id: string;
  clientId: string;
  type: string;
  sendCurrency: string;
  sendAmount: number;
  receiveCurrency: string;
  receiveAmount: number;
  rateApplied: number;
  feeCharged: number;
  beneficiaryName?: string;
  beneficiaryDetails?: string;
  userNotes?: string;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onTransactionCreated: (transaction: Transaction) => void;
}

type TransactionType = 'CASH_EXCHANGE' | 'BANK_TRANSFER';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'IRR'];

export function TransactionForm({
  open,
  onOpenChange,
  clientId,
  clientName,
  onTransactionCreated,
}: TransactionFormProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>('CASH_EXCHANGE');
  const [formData, setFormData] = useState({
    sendCurrency: 'EUR',
    sendAmount: '',
    receiveCurrency: 'IRR',
    receiveAmount: '',
    rateApplied: '',
    feeCharged: '',
    beneficiaryName: '',
    beneficiaryDetails: '',
    userNotes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate receive amount based on rate and fee
  const calculateReceiveAmount = () => {
    const send = parseFloat(formData.sendAmount) || 0;
    const rate = parseFloat(formData.rateApplied) || 0;
    const fee = parseFloat(formData.feeCharged) || 0;

    if (send > 0 && rate > 0) {
      const amountAfterFee = send - fee;
      const received = amountAfterFee * rate;
      setFormData(prev => ({ ...prev, receiveAmount: received.toFixed(2) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.sendCurrency ||
      !formData.sendAmount ||
      !formData.receiveCurrency ||
      !formData.receiveAmount ||
      !formData.rateApplied ||
      formData.feeCharged === ''
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate bank transfer specific fields
    if (transactionType === 'BANK_TRANSFER' && !formData.beneficiaryDetails.trim()) {
      toast.error('IBAN/Card Number is required for bank transfers');
      return;
    }

    setIsSubmitting(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${API_BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          type: transactionType,
          sendCurrency: formData.sendCurrency,
          sendAmount: parseFloat(formData.sendAmount),
          receiveCurrency: formData.receiveCurrency,
          receiveAmount: parseFloat(formData.receiveAmount),
          rateApplied: parseFloat(formData.rateApplied),
          feeCharged: parseFloat(formData.feeCharged),
          beneficiaryName: formData.beneficiaryName,
          beneficiaryDetails: formData.beneficiaryDetails,
          userNotes: formData.userNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create transaction');
      }

      const newTransaction = await response.json();
      toast.success('Transaction created successfully');
      onTransactionCreated(newTransaction);
      onOpenChange(false);
      // Reset form
      setFormData({
        sendCurrency: 'EUR',
        sendAmount: '',
        receiveCurrency: 'IRR',
        receiveAmount: '',
        rateApplied: '',
        feeCharged: '',
        beneficiaryName: '',
        beneficiaryDetails: '',
        userNotes: '',
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Transaction - {clientName}</DialogTitle>
          <DialogDescription>
            Record a new currency exchange or bank transfer transaction.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Transaction Type Selection */}
            <div className="space-y-3">
              <Label>Transaction Type *</Label>
              <RadioGroup
                value={transactionType}
                onValueChange={(value) => setTransactionType(value as TransactionType)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CASH_EXCHANGE" id="cash" />
                  <Label htmlFor="cash" className="cursor-pointer">
                    Cash Exchange (FX) - Client exchanges cash currencies
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="BANK_TRANSFER" id="bank" />
                  <Label htmlFor="bank" className="cursor-pointer">
                    Bank Transfer (Remittance) - Send money to Iranian bank account
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Send Amount Section */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sendCurrency">Send Currency *</Label>
                    <select
                      id="sendCurrency"
                      value={formData.sendCurrency}
                      onChange={(e) =>
                        setFormData({ ...formData, sendCurrency: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sendAmount">Send Amount *</Label>
                    <Input
                      id="sendAmount"
                      type="number"
                      step="0.01"
                      value={formData.sendAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, sendAmount: e.target.value })
                      }
                      placeholder="1000"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate & Fee Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rateApplied">Exchange Rate *</Label>
                <Input
                  id="rateApplied"
                  type="number"
                  step="0.000001"
                  value={formData.rateApplied}
                  onChange={(e) => setFormData({ ...formData, rateApplied: e.target.value })}
                  placeholder="65000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feeCharged">Fee Charged *</Label>
                <Input
                  id="feeCharged"
                  type="number"
                  step="0.01"
                  value={formData.feeCharged}
                  onChange={(e) => setFormData({ ...formData, feeCharged: e.target.value })}
                  placeholder="10"
                  required
                />
              </div>
            </div>

            {/* Calculate Button */}
            <Button
              type="button"
              variant="outline"
              onClick={calculateReceiveAmount}
              className="w-full"
            >
              <Calculator className="mr-2 h-4 w-4" />
              Calculate Receive Amount
            </Button>

            {/* Receive Amount Section */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="receiveCurrency">Receive Currency *</Label>
                    <select
                      id="receiveCurrency"
                      value={formData.receiveCurrency}
                      onChange={(e) =>
                        setFormData({ ...formData, receiveCurrency: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiveAmount">Receive Amount *</Label>
                    <Input
                      id="receiveAmount"
                      type="number"
                      step="0.01"
                      value={formData.receiveAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, receiveAmount: e.target.value })
                      }
                      placeholder="64350000"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Transfer Specific Fields */}
            {transactionType === 'BANK_TRANSFER' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="beneficiaryName">Beneficiary Name</Label>
                    <Input
                      id="beneficiaryName"
                      value={formData.beneficiaryName}
                      onChange={(e) =>
                        setFormData({ ...formData, beneficiaryName: e.target.value })
                      }
                      placeholder="Ali Rezaei"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="beneficiaryDetails">IBAN / Card Number *</Label>
                    <Input
                      id="beneficiaryDetails"
                      value={formData.beneficiaryDetails}
                      onChange={(e) =>
                        setFormData({ ...formData, beneficiaryDetails: e.target.value })
                      }
                      placeholder="IR120123456789012345678901"
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="userNotes">Internal Notes</Label>
              <Textarea
                id="userNotes"
                value={formData.userNotes}
                onChange={(e) => setFormData({ ...formData, userNotes: e.target.value })}
                placeholder="Any additional notes about this transaction..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
