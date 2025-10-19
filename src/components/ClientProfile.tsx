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
} from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { EditTransactionDialog } from './EditTransactionDialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
  email: string;
  joinDate: string;
}

interface Transaction {
  transactionId: string;
  clientId: string;
  date: string;
  type: string;
  sendCurrency: string;
  sendAmount: number;
  receiveCurrency: string;
  receiveAmount: number;
  rateApplied: number;
  feeCharged: number;
  beneficiaryName: string;
  beneficiaryDetails: string;
  userNotes: string;
  isEdited?: boolean;
  lastEditedAt?: string;
  editHistory?: Array<{
    editedAt: string;
    previousVersion: any;
  }>;
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a3e538f5/clients/${client.id}/transactions`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to fetch transactions:', errorData);
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }

      const data = await response.json();
      if (data.success) {
        // Filter out any null or invalid transactions
        const validTransactions = (data.transactions || []).filter(
          (tx: Transaction | null) => tx && tx.transactionId && tx.date
        );
        setTransactions(validTransactions);
      } else {
        console.error('Error response from server:', data);
        toast.error(data.error || 'Failed to load transaction history');
      }
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
        tx.transactionId === updatedTransaction.transactionId ? updatedTransaction : tx
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
                  <Card key={tx.transactionId} className="hover:shadow-md transition-shadow">
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
                              {new Date(tx.date).toLocaleString()}
                            </span>
                            {tx.isEdited && tx.editHistory && tx.editHistory.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 px-2">
                                    <Info className="h-3 w-3 mr-1" />
                                    <span className="text-xs">View Previous</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-96">
                                  <div className="space-y-3">
                                    <h4 className="text-sm">Edit History</h4>
                                    {tx.editHistory.map((edit, index) => (
                                      <div
                                        key={index}
                                        className="p-3 bg-gray-50 rounded-md text-xs space-y-1"
                                      >
                                        <p className="text-gray-500">
                                          Edited: {new Date(edit.editedAt).toLocaleString()}
                                        </p>
                                        <div className="space-y-0.5">
                                          <p>
                                            Send: {edit.previousVersion.sendAmount.toLocaleString()}{' '}
                                            {edit.previousVersion.sendCurrency}
                                          </p>
                                          <p>
                                            Receive:{' '}
                                            {edit.previousVersion.receiveAmount.toLocaleString()}{' '}
                                            {edit.previousVersion.receiveCurrency}
                                          </p>
                                          <p>Rate: {edit.previousVersion.rateApplied.toLocaleString()}</p>
                                          <p>Fee: {edit.previousVersion.feeCharged.toLocaleString()}</p>
                                          {edit.previousVersion.beneficiaryDetails && (
                                            <p>Beneficiary: {edit.previousVersion.beneficiaryDetails}</p>
                                          )}
                                          {edit.previousVersion.userNotes && (
                                            <p className="italic">Note: {edit.previousVersion.userNotes}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
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
        </CardContent>
      </Card>

      <TransactionForm
        open={showTransactionForm}
        onOpenChange={setShowTransactionForm}
        clientId={client.id}
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
    </>
  );
}
