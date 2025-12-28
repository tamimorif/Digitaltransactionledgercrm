'use client';

import { useState } from 'react';
import { useGetTransactions } from '@/src/lib/queries/client.query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
  History,
  Filter,
  FilterX,
  Wallet,
} from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { EditTransactionDialog } from './EditTransactionDialog';
import { CurrencySummary } from './CurrencySummary';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from 'sonner';
import { PaymentDialog } from './PaymentDialog';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';

interface Client {
  id: number | string;
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
  branch?: {
    id: number;
    name: string;
  };
  // Multi-payment fields
  totalReceived?: number;
  receivedCurrency?: string;
  remainingBalance?: number;
  paymentStatus?: string;
  allowPartialPayment?: boolean;
  // Profit field
  profit?: number;
}

interface EditHistoryEntry {
  type?: string;
  sendAmount?: number;
  sendCurrency?: string;
  receiveAmount?: number;
  receiveCurrency?: string;
  rateApplied?: number;
  feeCharged?: number;
  beneficiaryName?: string;
  beneficiaryDetails?: string;
  userNotes?: string;
  editedAt?: string;
}

interface ClientProfileProps {
  client: Client;
  onClose: () => void;
}

export function ClientProfile({ client, onClose }: ClientProfileProps) {
  const clientIdString = String(client.id);
  const [dateFilter, setDateFilter] = useState<{ startDate?: string; endDate?: string }>({});
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const { data: transactions = [], isLoading, refetch } = useGetTransactions(clientIdString, dateFilter, selectedBranch);
  const { data: branches } = useGetBranches();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [paymentDialogTransaction, setPaymentDialogTransaction] = useState<Transaction | null>(null);

  const handleApplyDateFilter = (start?: string, end?: string) => {
    setDateFilter({ startDate: start, endDate: end });
  };

  const handleClearDateFilter = () => {
    setDateFilter({});
  };

  const handleTransactionCreated = () => {
    refetch();
    setShowTransactionForm(false);
    toast.success('Transaction created successfully');
  };

  const handleTransactionUpdated = () => {
    refetch();
    setEditingTransaction(null);
    toast.success('Transaction updated successfully');
  };

  const handlePaymentAdded = () => {
    refetch();
    toast.success('Payment added successfully');
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
            <Button variant="outline" onClick={() => window.location.href = `/clients/${client.id}/ledger`}>
              <Wallet className="h-4 w-4 mr-2" />
              View Ledger
            </Button>
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

          {/* Currency Summary */}
          {transactions.length > 0 && (
            <>
              <Separator className="my-6" />
              <CurrencySummary transactions={transactions} />
            </>
          )}

          <Separator className="my-6" />

          {/* Transaction History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3>Transaction History</h3>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover open={showDateFilter} onOpenChange={setShowDateFilter}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter by Date
                    {(dateFilter.startDate || dateFilter.endDate) && (
                      <Badge variant="secondary" className="ml-2">
                        Active
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Date Range Filter</h4>
                      <p className="text-sm text-muted-foreground">
                        Filter transactions by date range
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={dateFilter.startDate || ''}
                          onChange={(e) =>
                            handleApplyDateFilter(e.target.value, dateFilter.endDate)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={dateFilter.endDate || ''}
                          onChange={(e) =>
                            handleApplyDateFilter(dateFilter.startDate, e.target.value)
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleClearDateFilter();
                            setShowDateFilter(false);
                          }}
                          className="flex-1"
                        >
                          <FilterX className="h-4 w-4 mr-2" />
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowDateFilter(false)}
                          className="flex-1"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
                  <Card key={tx.id} className={`hover:shadow-md transition-shadow ${tx.paymentStatus === 'OPEN' || tx.paymentStatus === 'PARTIAL' ? 'border-l-4 border-l-blue-500' : ''}`}>
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
                            {tx.paymentStatus && tx.paymentStatus !== 'SINGLE' && (
                              <Badge variant={tx.paymentStatus === 'FULLY_PAID' ? 'outline' : 'default'} className={tx.paymentStatus === 'FULLY_PAID' ? 'text-green-600 border-green-600' : 'bg-blue-600'}>
                                {tx.paymentStatus === 'OPEN' ? 'Open Credit' : tx.paymentStatus === 'PARTIAL' ? 'Partial' : 'Fully Paid'}
                              </Badge>
                            )}
                            {tx.isEdited && (
                              <Badge variant="outline" className="bg-yellow-50">
                                Edited
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(tx.transactionDate).toLocaleString()}
                            </span>
                            {tx.branch && (
                              <Badge variant="outline" className="text-gray-500 border-gray-300">
                                {tx.branch.name}
                              </Badge>
                            )}
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
                                              const history = JSON.parse(tx.editHistory || '[]') as EditHistoryEntry[];
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
                                        const history = JSON.parse(tx.editHistory || '[]') as EditHistoryEntry[];
                                        return history.slice().reverse().map((edit, index: number) => (
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
                                                {edit.editedAt ? (
                                                  <>
                                                    {new Date(edit.editedAt).toLocaleDateString()} at{' '}
                                                    {new Date(edit.editedAt).toLocaleTimeString([], {
                                                      hour: '2-digit',
                                                      minute: '2-digit'
                                                    })}
                                                  </>
                                                ) : (
                                                  'Date unavailable'
                                                )}
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
                                      } catch {
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

                          {/* Remaining Balance for Open Transactions */}
                          {(tx.paymentStatus === 'OPEN' || tx.paymentStatus === 'PARTIAL') && tx.remainingBalance !== undefined && (
                            <div className="mt-2 mb-2 p-2 bg-blue-50 rounded border border-blue-100 flex justify-between items-center">
                              <span className="text-xs font-medium text-blue-700">Remaining Balance:</span>
                              <span className="text-sm font-bold text-blue-800">
                                {tx.remainingBalance.toLocaleString()} {tx.receivedCurrency}
                              </span>
                            </div>
                          )}

                          <div className="text-xs text-gray-600 space-y-1">
                            <p>
                              Rate: {tx.rateApplied.toLocaleString()} | Fee:{' '}
                              {tx.feeCharged.toLocaleString()}
                              {tx.profit !== undefined && (
                                <span className="ml-2 font-medium text-green-600">
                                  | Profit: {tx.profit.toLocaleString()} CAD
                                </span>
                              )}
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
                        <div className="flex flex-col gap-2 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTransaction(tx)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          {/* Drawdown Button */}
                          {(tx.paymentStatus === 'OPEN' || tx.paymentStatus === 'PARTIAL') && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                              onClick={() => setPaymentDialogTransaction(tx)}
                            >
                              Drawdown
                            </Button>
                          )}
                        </div>
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
        clientId={String(client.id)}
        clientName={client.name}
        onTransactionCreated={handleTransactionCreated}
      />

      {editingTransaction && (
        <EditTransactionDialog
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
          onTransactionUpdated={handleTransactionUpdated}
        />
      )}

      {paymentDialogTransaction && (
        <PaymentDialog
          open={!!paymentDialogTransaction}
          onOpenChange={(open) => !open && setPaymentDialogTransaction(null)}
          transaction={{
            id: paymentDialogTransaction.id,
            remainingBalance: paymentDialogTransaction.remainingBalance || 0,
            receivedCurrency: paymentDialogTransaction.receivedCurrency || paymentDialogTransaction.receiveCurrency,
            totalReceived: paymentDialogTransaction.totalReceived || paymentDialogTransaction.receiveAmount,
          }}
          onPaymentAdded={handlePaymentAdded}
        />
      )}
    </>
  );
}
