'use client';

import { useState, useEffect } from 'react';
import { useCreatePayment } from '@/src/lib/queries/client.query';
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
import { Card, CardContent } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { getErrorMessage } from '@/src/lib/error';

interface Transaction {
  id: string;
  remainingBalance: number;
  receivedCurrency: string; // The currency we hold (e.g. Toman)
  totalReceived: number;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onPaymentAdded: () => void;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

export function PaymentDialog({
  open,
  onOpenChange,
  transaction,
  onPaymentAdded,
}: PaymentDialogProps) {
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'CAD',
    exchangeRate: '',
    notes: '',
  });
  const [calculatedDeduction, setCalculatedDeduction] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createPayment = useCreatePayment(transaction.id);

  // Calculate deduction whenever amount or rate changes
  useEffect(() => {
    const amount = parseFloat(formData.amount) || 0;
    const rate = parseFloat(formData.exchangeRate) || 0;
    setCalculatedDeduction(amount * rate);
  }, [formData.amount, formData.exchangeRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.exchangeRate) {
      toast.error('Please fill in amount and exchange rate');
      return;
    }

    if (calculatedDeduction > transaction.remainingBalance) {
      toast.error('Deduction exceeds remaining balance');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPayment.mutateAsync({
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        exchangeRate: parseFloat(formData.exchangeRate),
        notes: formData.notes,
        paymentMethod: 'CASH', // Default for now
      });

      toast.success('Payment added successfully');
      onPaymentAdded();
      onOpenChange(false);
      // Reset form
      setFormData({
        amount: '',
        currency: 'CAD',
        exchangeRate: '',
        notes: '',
      });
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Failed to add payment', {
        description: getErrorMessage(error, 'Please try again'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment / Drawdown</DialogTitle>
          <DialogDescription>
            Record a payment from the client&apos;s balance.
          </DialogDescription>
        </DialogHeader>

        {/* Current Balance Card */}
        <Card className="bg-blue-50 border-blue-200 mb-4">
          <CardContent className="pt-4 pb-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-600 font-medium">Remaining Balance</p>
              <p className="text-xl font-bold text-blue-900">
                {transaction.remainingBalance.toLocaleString()} {transaction.receivedCurrency}
              </p>
            </div>
            <Wallet className="h-8 w-8 text-blue-300" />
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency: value })
                }
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select" />
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
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="e.g. 500"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exchangeRate">
              Exchange Rate (1 {formData.currency} = ? {transaction.receivedCurrency})
            </Label>
            <Input
              id="exchangeRate"
              type="number"
              step="0.000001"
              value={formData.exchangeRate}
              onChange={(e) =>
                setFormData({ ...formData, exchangeRate: e.target.value })
              }
              placeholder="e.g. 80300"
              required
            />
          </div>

          {/* Calculation Preview */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Deduction Amount:</span>
              <span className="font-bold text-gray-900">
                {calculatedDeduction.toLocaleString()} {transaction.receivedCurrency}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-500">New Balance:</span>
              <span className={`font-bold ${
                transaction.remainingBalance - calculatedDeduction < 0 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {(transaction.remainingBalance - calculatedDeduction).toLocaleString()} {transaction.receivedCurrency}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Paid in Vancouver branch"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
