'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  User,
  Phone,
  Mail,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Edit,
  Info,
  History,
} from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { EditTransactionDialog } from './EditTransactionDialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
  email: string;
  joinDate: string;
}

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

interface ClientProfileProps {
  client: Client;
  onClose: () => void;
}

export function ClientProfile({ client, onClose }: ClientProfileProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, [client.id]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${API_BASE_URL}/api/clients/${client.id}/transactions`);

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const transactions = await response.json();
      setTransactions(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionCreated = (newTransaction: Transaction) => {
    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === updatedTransaction.id ? updatedTransaction : tx
      )
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const totalTransactions = transactions.length;
  const totalVolume = transactions.reduce((sum, tx) => sum + tx.sendAmount, 0);

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>{client.name}</CardTitle>
              <p className="text-sm text-gray-500">Client Profile</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowTransactionForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Transaction
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Client Information */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm">{client.phoneNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm">{client.email || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Client Since</p>
                <p className="text-sm">{new Date(client.joinDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="bg-blue-50">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl">{totalTransactions}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-600">Total Volume</p>
                <p className="text-2xl">{totalVolume.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-6" />

          {/* Transaction History */}
          <div>
            <h3 className="mb-4">Transaction History</h3>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No transactions yet</p>
                <Button
                  variant="link"
                  onClick={() => setShowTransactionForm(true)}
                  className="mt-2"
                >
                  Create first transaction
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <Card key={tx.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={
                                tx.type === 'CASH_EXCHANGE' ? 'default' : 'secondary'
                              }
                            >
                              {tx.type === 'CASH_EXCHANGE' ? 'Cash Exchange' : 'Bank Transfer'}
                            </Badge>
                            {tx.isEdited && (
                              <Badge variant="outline" className="bg-yellow-50">
                                Edited
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(tx.transactionDate).toLocaleString()}
                            </span>
                            {tx.isEdited && tx.editHistory && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                                  >
                                    <History className="h-3 w-3 mr-1" />
                                    <span className="text-xs font-medium">View Previous</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[500px] p-0 max-h-[600px] overflow-hidden" align="start">
                                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-200">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-amber-100 rounded-full">
                                        <History className="h-4 w-4 text-amber-700" />
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-bold text-amber-900">Edit History</h4>
                                        <p className="text-xs text-amber-700">
                                          {(() => {
                                            try {
                                              const history = JSON.parse(tx.editHistory || '[]');
                                              return `${history.length} previous ${history.length === 1 ? 'version' : 'versions'}`;
                                            } catch {
                                              return 'Previous versions';
                                            }
                                          })()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                                    {(() => {
                                      try {
                                        const history = JSON.parse(tx.editHistory || '[]');
                                        return history.slice().reverse().map((edit: any, index: number) => (
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
                                              <span className="text-xs text-gray-400 font-medium">
                                                {new Date(edit.editedAt).toLocaleDateString()} at{' '}
                                                {new Date(edit.editedAt).toLocaleTimeString([], {
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </span>
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
                                        ));
                                      } catch (error) {
                                        return (
                                          <div className="text-sm text-gray-500 text-center py-4">
                                            Unable to load edit history
                                          </div>
                                        );
                                      }
                                    })()}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-1">
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                              <span>{formatCurrency(tx.sendAmount, tx.sendCurrency)}</span>
                            </div>
                            <span className="text-gray-400">→</span>
                            <div className="flex items-center gap-1">
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                              <span>{formatCurrency(tx.receiveAmount, tx.receiveCurrency)}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <p>
                              Rate: {tx.rateApplied.toLocaleString()} | Fee:{' '}
                              {tx.feeCharged.toLocaleString()}
                            </p>
                            {tx.type === 'BANK_TRANSFER' && tx.beneficiaryDetails && (
                              <p>
                                Beneficiary: {tx.beneficiaryName || 'N/A'} |{' '}
                                {tx.beneficiaryDetails}
                              </p>
                            )}
                            {tx.userNotes && <p className="italic">Note: {tx.userNotes}</p>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTransaction(tx)}
                          className="ml-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent >
      </Card >

      <TransactionForm
        open={showTransactionForm}
        onOpenChange={setShowTransactionForm}
        clientId={client.id}
        clientName={client.name}
        onTransactionCreated={handleTransactionCreated}
      />

      {
        editingTransaction && (
          <EditTransactionDialog
            open={!!editingTransaction}
            onOpenChange={(open) => !open && setEditingTransaction(null)}
            transaction={editingTransaction}
            onTransactionUpdated={handleTransactionUpdated}
          />
        )
      }
    </>
  );
}
