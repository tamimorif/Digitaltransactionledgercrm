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

export default function DashboardPage() {
  const { user, tenant, logout } = useAuth();
  const { data: licenseStatus, isLoading: isLicenseLoading } = useGetLicenseStatus();

  const isTrialExpired = user?.status === 'trial_expired';
  const isLicenseExpired = user?.status === 'license_expired';
  const needsActivation = isTrialExpired || isLicenseExpired;

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

      {/* Cash on Hand Widget */}
      <CashOnHandWidget />
    </div>
  );
}
