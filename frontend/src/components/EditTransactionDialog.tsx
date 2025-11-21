'use client';

import { useState, useEffect } from 'react';
import { useUpdateTransaction } from '@/src/lib/queries/client.query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { Calculator, AlertCircle, History, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';

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
  isEdited?: boolean;
  lastEditedAt?: string;
  editHistory?: string;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onTransactionUpdated: (transaction: Transaction) => void;
}

type TransactionType = 'CASH_EXCHANGE' | 'BANK_TRANSFER';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onTransactionUpdated,
}: EditTransactionDialogProps) {
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
  const [showHistory, setShowHistory] = useState(false);
  const [editHistory, setEditHistory] = useState<any[]>([]);

  // Load transaction data when dialog opens
  useEffect(() => {
    if (open && transaction) {
      setTransactionType(transaction.type as TransactionType);
      setFormData({
        sendCurrency: transaction.sendCurrency,
        sendAmount: transaction.sendAmount.toString(),
        receiveCurrency: transaction.receiveCurrency,
        receiveAmount: transaction.receiveAmount.toString(),
        rateApplied: transaction.rateApplied.toString(),
        feeCharged: transaction.feeCharged.toString(),
        beneficiaryName: transaction.beneficiaryName || '',
        beneficiaryDetails: transaction.beneficiaryDetails || '',
        userNotes: transaction.userNotes || '',
      });

      // Parse edit history
      if (transaction.editHistory) {
        try {
          const history = JSON.parse(transaction.editHistory);
          setEditHistory(Array.isArray(history) ? history : []);
        } catch (error) {
          console.error('Failed to parse edit history:', error);
          setEditHistory([]);
        }
      } else {
        setEditHistory([]);
      }
    }
  }, [open, transaction]);

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

  const updateTransaction = useUpdateTransaction(transaction.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-calculate receive amount before saving
    const send = parseFloat(formData.sendAmount) || 0;
    const rate = parseFloat(formData.rateApplied) || 0;
    const fee = parseFloat(formData.feeCharged) || 0;

    let finalReceiveAmount = formData.receiveAmount;
    if (send > 0 && rate > 0) {
      const amountAfterFee = send - fee;
      const received = amountAfterFee * rate;
      finalReceiveAmount = received.toFixed(2);
    }

    // Validate required fields
    if (
      !formData.sendCurrency ||
      !formData.sendAmount ||
      !formData.receiveCurrency ||
      !finalReceiveAmount ||
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
      const updatedTransaction = await updateTransaction.mutateAsync({
        type: transactionType,
        sendCurrency: formData.sendCurrency,
        sendAmount: parseFloat(formData.sendAmount),
        receiveCurrency: formData.receiveCurrency,
        receiveAmount: parseFloat(finalReceiveAmount),
        rateApplied: parseFloat(formData.rateApplied),
        feeCharged: parseFloat(formData.feeCharged),
        beneficiaryName: formData.beneficiaryName || undefined,
        beneficiaryDetails: formData.beneficiaryDetails || undefined,
        userNotes: formData.userNotes || undefined,
      });

      toast.success('Transaction updated successfully');
      onTransactionUpdated(updatedTransaction);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction', {
        description: error?.response?.data?.error || 'Please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update transaction details. Previous values will be saved in edit history.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This transaction will be marked as edited and the original values will be preserved in the history.
          </AlertDescription>
        </Alert>

        {/* Edit History */}
        {transaction.isEdited && editHistory.length > 0 && (
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-2 h-auto hover:bg-amber-100/50 rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-full">
                        <History className="h-4 w-4 text-amber-700" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-amber-900">
                          Edit History
                        </div>
                        <div className="text-xs text-amber-700">
                          {editHistory.length} previous {editHistory.length === 1 ? 'version' : 'versions'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                      {showHistory ? '▲ Hide' : '▼ Show'}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {editHistory.slice().reverse().map((edit, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white rounded-xl border-2 border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                              Version {index + 1}
                            </div>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                              {edit.type === 'CASH_EXCHANGE' ? '💵 Cash Exchange' : '🏦 Bank Transfer'}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400 font-medium">
                              {new Date(edit.editedAt).toLocaleDateString()} at{' '}
                              {new Date(edit.editedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            {edit.editedByBranchName && (
                              <div className="text-xs text-blue-600 font-medium mt-0.5">
                                Edited by: {edit.editedByBranchName}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transaction Details */}
                        <div className="space-y-3">
                          {/* Main Transaction Flow */}
                          <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 mb-0.5">Send Amount</div>
                              <div className="text-lg font-bold text-gray-800">
                                {Number(edit.sendAmount).toFixed(2)} {edit.sendCurrency}
                              </div>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div className="flex-1 text-right">
                              <div className="text-xs text-gray-500 mb-0.5">Receive Amount</div>
                              <div className="text-lg font-bold text-gray-800">
                                {Number(edit.receiveAmount).toFixed(2)} {edit.receiveCurrency}
                              </div>
                            </div>
                          </div>

                          {/* Rate and Fee */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                              <div className="text-xs text-purple-600 font-medium mb-0.5">Exchange Rate</div>
                              <div className="text-sm font-bold text-purple-900">
                                {Number(edit.rateApplied).toFixed(4)}
                              </div>
                            </div>
                            <div className="p-2 bg-orange-50 rounded-lg border border-orange-100">
                              <div className="text-xs text-orange-600 font-medium mb-0.5">Fee Charged</div>
                              <div className="text-sm font-bold text-orange-900">
                                {Number(edit.feeCharged).toFixed(2)} {edit.sendCurrency}
                              </div>
                            </div>
                          </div>

                          {/* Beneficiary Info */}
                          {edit.beneficiaryName && (
                            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                              <div className="text-xs text-indigo-600 font-medium mb-0.5">Beneficiary</div>
                              <div className="text-sm font-semibold text-indigo-900">{edit.beneficiaryName}</div>
                              {edit.beneficiaryDetails && (
                                <div className="text-xs text-indigo-700 mt-1 font-mono">
                                  {edit.beneficiaryDetails}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          {edit.userNotes && (
                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="text-xs text-gray-500 font-medium mb-1">📝 Notes</div>
                              <div className="text-xs text-gray-700 italic">{edit.userNotes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
                    <Select
                      value={formData.sendCurrency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, sendCurrency: value })
                      }
                    >
                      <SelectTrigger id="sendCurrency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr}>
                            {curr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              Recalculate Receive Amount
            </Button>

            {/* Receive Amount Section */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="receiveCurrency">Receive Currency *</Label>
                    <Select
                      value={formData.receiveCurrency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, receiveCurrency: value })
                      }
                    >
                      <SelectTrigger id="receiveCurrency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr}>
                            {curr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
