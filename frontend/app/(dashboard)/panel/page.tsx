'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetClients } from '@/src/lib/queries/client.query';
import { DailyRatesWidget } from '@/src/components/DailyRatesWidget';
import { CashOnHandWidget } from '@/src/components/CashOnHandWidget';
import { BuySellRatesWidget } from '@/src/components/BuySellRatesWidget';
import { ClientSearch } from '@/src/components/ClientSearch';
import { ClientProfile } from '@/src/components/ClientProfile';
import { NewClientDialog } from '@/src/components/NewClientDialog';
import { WalkInCustomerDialog } from '@/src/components/WalkInCustomerDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Building2, TrendingUp, Loader2, Send, Search, User, Users, DollarSign, Package } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/src/lib/api-client';
import { formatDistanceToNow } from 'date-fns';

type PanelMode = 'client' | 'send-pickup' | 'receive-pickup' | 'walk-in';

export default function PanelPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: clients = [], isLoading } = useGetClients();
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('client');

  // Fetch cash balances
  const { data: balances, isLoading: isBalancesLoading } = useQuery({
    queryKey: ['cash-balances'],
    queryFn: async () => {
      const response = await apiClient.get('/cash-balances');
      return response.data;
    },
  });

  // Fetch pending pickups count
  const { data: pendingCount, isLoading: isPendingCountLoading } = useQuery({
    queryKey: ['pending-pickups-count'],
    queryFn: async () => {
      const response = await apiClient.get('/pickups/pending/count');
      return response.data;
    },
  });

  // Redirect SuperAdmin to admin dashboard
  useEffect(() => {
    if (user?.role === 'superadmin') {
      router.push('/admin');
    }
  }, [user, router]);

  const handleClientSelect = (client: any) => {
    setSelectedClient(client);
  };

  // Don't render for SuperAdmin
  if (user?.role === 'superadmin') {
    return null;
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Today's Cash Balance by Currency */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Today&apos;s Cash Balance by Currency
          </CardTitle>
          <CardDescription>Current cash on hand across all branches</CardDescription>
        </CardHeader>
        <CardContent>
          {isBalancesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : balances && balances.length > 0 ? (
            <div className="space-y-4">
              {balances.map((balance: any) => (
                <div key={balance.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{balance.currency}</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Available Balance</p>
                      <p className="text-2xl font-bold">
                        {parseFloat(balance.amount || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm">
                      {balance.lastUpdated
                        ? formatDistanceToNow(new Date(balance.lastUpdated), { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No cash balances available</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Pickups Counter */}
      <Link href="/pending-pickups">
        <Card className="cursor-pointer hover:bg-accent transition-colors mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pending Pickups
            </CardTitle>
            <CardDescription>Click to view all pending pickup transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {isPendingCountLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-4xl font-bold text-primary">
                  {pendingCount?.count || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pendingCount?.count === 1 ? 'transaction' : 'transactions'} waiting for pickup
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Main Content */}
      {!selectedClient ? (
        <div className="space-y-8">
          {/* Transaction Type Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Panel</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={panelMode} onValueChange={(v) => setPanelMode(v as PanelMode)} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="client" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Client Transaction
                  </TabsTrigger>
                  <TabsTrigger value="send-pickup" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Money
                  </TabsTrigger>
                  <TabsTrigger value="receive-pickup" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Receive Money
                  </TabsTrigger>
                  <TabsTrigger value="walk-in" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Walk-in Customer
                  </TabsTrigger>
                </TabsList>

                {/* Client Transaction Tab */}
                <TabsContent value="client" className="space-y-4 mt-6">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold mb-2">Find Client</h2>
                    <p className="text-sm text-gray-500">
                      Search by phone number or name to view transaction history
                    </p>
                  </div>
                  <ClientSearch
                    clients={clients}
                    onClientSelect={handleClientSelect}
                    onNewClient={() => setShowNewClientDialog(true)}
                  />
                </TabsContent>

                {/* Send Money Tab */}
                <TabsContent value="send-pickup" className="space-y-4 mt-6">
                  <div className="text-center py-8">
                    <Send className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Send Money</h3>
                    <p className="text-muted-foreground mb-6">
                      Send money to another branch for pickup
                    </p>
                    <Link href="/send-pickup">
                      <Button size="lg">
                        <Send className="mr-2 h-4 w-4" />
                        Go to Send Money
                      </Button>
                    </Link>
                  </div>
                </TabsContent>

                {/* Receive Money Tab */}
                <TabsContent value="receive-pickup" className="space-y-4 mt-6">
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Receive Money</h3>
                    <p className="text-muted-foreground mb-6">
                      Search by code, phone number, or name to process money pickup
                    </p>
                    <Link href="/pickup-search">
                      <Button size="lg">
                        <Search className="mr-2 h-4 w-4" />
                        Go to Receive Money
                      </Button>
                    </Link>
                  </div>
                </TabsContent>

                {/* Walk-in Customer Tab */}
                <TabsContent value="walk-in" className="space-y-4 mt-6">
                  <div className="text-center py-8">
                    <User className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Walk-in Customer</h3>
                    <p className="text-muted-foreground mb-6">
                      Complete transaction for walk-in customers with comprehensive details
                    </p>
                    <Button size="lg" onClick={() => setShowWalkInDialog(true)}>
                      <User className="mr-2 h-4 w-4" />
                      Start Walk-in Transaction
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Recent Activity / Stats */}
          {!isLoading && clients.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-semibold">Quick Stats</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Clients</p>
                    <p className="text-2xl font-bold mt-1">{clients.length}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Active Today</p>
                    <p className="text-2xl font-bold mt-1">0</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-2xl font-bold mt-1">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && clients.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Clients Yet</h3>
                <p className="text-gray-500 mb-4">
                  Start by creating your first client profile
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <Card>
              <CardContent className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <ClientProfile
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}

      <NewClientDialog
        open={showNewClientDialog}
        onOpenChange={setShowNewClientDialog}
        onClientCreated={(newClient) => {
          setShowNewClientDialog(false);
          setSelectedClient(newClient);
        }}
      />

      <WalkInCustomerDialog
        open={showWalkInDialog}
        onOpenChange={setShowWalkInDialog}
        onTransactionCreated={() => {
          // Optionally refresh client list or show success
        }}
      />
    </div>
  );
}
