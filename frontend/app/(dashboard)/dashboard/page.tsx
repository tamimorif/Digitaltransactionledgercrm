'use client';

import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetLicenseStatus } from '@/src/queries/license.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Loader2, Building2, Mail, Calendar, Crown, Users, AlertTriangle, DollarSign, Package } from 'lucide-react';
import { LicenseActivationCard } from '@/src/components/dashboard/LicenseActivationCard';
import { MyLicensesCard } from '@/src/components/dashboard/MyLicensesCard';
import { BuySellRatesWidget } from '@/src/components/BuySellRatesWidget';
import { CashOnHandWidget } from '@/src/components/CashOnHandWidget';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/src/lib/api-client';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { RefreshCw, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import {
  useGetAllBalances,
  useGetActiveCurrencies,
  useRefreshAllBalances,
  useCreateAdjustment,
} from '@/src/lib/queries/cash-balance.query';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user, tenant, logout } = useAuth();
  const { data: licenseStatus, isLoading: isLicenseLoading } = useGetLicenseStatus();

  const isTrialExpired = user?.status === 'trial_expired';
  const isLicenseExpired = user?.status === 'license_expired';
  const needsActivation = isTrialExpired || isLicenseExpired;

  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data: cashBalances, isLoading: balancesLoading, refetch: refetchBalances } = useGetAllBalances();
  const { data: currencies } = useGetActiveCurrencies();
  const refreshAllMutation = useRefreshAllBalances();
  const createAdjustmentMutation = useCreateAdjustment();

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

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      superadmin: 'Super Admin',
      tenant_owner: 'Owner',
      tenant_admin: 'Admin',
      tenant_user: 'User',
    };
    return roles[role] || role;
  };

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; variant: any }> = {
      active: { label: 'Active', variant: 'default' },
      trial: { label: 'Trial', variant: 'secondary' },
      trial_expired: { label: 'Trial Expired', variant: 'destructive' },
      license_expired: { label: 'License Expired', variant: 'destructive' },
      suspended: { label: 'Suspended', variant: 'outline' },
    };
    const statusInfo = statuses[status] || { label: status, variant: 'outline' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {user?.email}
        </p>
      </div>

      {/* Warning for expired trial/license */}
      {needsActivation && (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">
                {isTrialExpired ? 'Trial Period Expired' : 'License Expired'}
              </CardTitle>
            </div>
            <CardDescription>
              You need to activate a license to use the system
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Buy and Sell Rates Widget */}
      <BuySellRatesWidget />

      {/* Cash Balance Management */}
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cash Balance
                </CardTitle>
                <CardDescription>Track your branch cash on hand by currency</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await refreshAllMutation.mutateAsync();
                      toast.success('All balances refreshed successfully');
                      refetchBalances();
                    } catch (error: any) {
                      toast.error(error.response?.data?.error || 'Failed to refresh balances');
                    }
                  }}
                  disabled={refreshAllMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
                  Refresh All
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (currencies && currencies.length > 0) {
                      setSelectedCurrency(currencies[0]);
                    }
                    setShowAdjustDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adjust Balance
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {balancesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !cashBalances || cashBalances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No cash balances yet</p>
                <p className="text-sm">Start by creating transactions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cashBalances.map((balance: any) => (
                  <Card key={`${balance.branchID}-${balance.currency}`} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {balance.currency}
                        </Badge>
                        {balance.calculatedBalance !== balance.manualBalance && (
                          <Badge variant="secondary" className="text-xs">
                            Adjusted
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold">
                            {balance.manualBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-sm text-muted-foreground">{balance.currency}</span>
                        </div>
                        {balance.calculatedBalance !== balance.manualBalance && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Calculated:</span>
                            <span>{balance.calculatedBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}</span>
                            {balance.manualBalance > balance.calculatedBalance ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Last updated: {new Date(balance.lastUpdated).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Cash Balance</DialogTitle>
            <DialogDescription>
              Manually adjust the cash balance for a specific currency
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies?.map((currency: string) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Adjustment Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter amount (positive to add, negative to subtract)"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use positive numbers to add, negative to subtract
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Why are you adjusting the balance?"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedCurrency || !adjustAmount || !adjustReason) {
                  toast.error('Please fill in all fields');
                  return;
                }
                try {
                  await createAdjustmentMutation.mutateAsync({
                    currency: selectedCurrency,
                    amount: parseFloat(adjustAmount),
                    reason: adjustReason,
                  });
                  toast.success('Balance adjusted successfully');
                  setShowAdjustDialog(false);
                  setAdjustAmount('');
                  setAdjustReason('');
                  refetchBalances();
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Failed to adjust balance');
                }
              }}
              disabled={createAdjustmentMutation.isPending}
            >
              {createAdjustmentMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
