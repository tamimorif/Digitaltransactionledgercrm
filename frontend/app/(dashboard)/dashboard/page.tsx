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
import { DashboardCashBalance } from '@/src/components/dashboard/DashboardCashBalance';
import { QuickConvertWidget } from '@/src/components/dashboard/QuickConvertWidget';
import { RecentActivityFeed } from '@/src/components/dashboard/RecentActivityFeed';
import { GlobalSearch } from '@/src/components/GlobalSearch';
import { AdvancedSearchDialog } from '@/src/components/AdvancedSearchDialog';
import { SavedSearchesDialog } from '@/src/components/SavedSearchesDialog';
import { LiveIndicator } from '@/src/components/LiveIndicator';
import { RateLimitNotification } from '@/src/components/RateLimitNotification';
import { useWebSocket, useTransactionUpdates, useCashBalanceUpdates } from '@/src/hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { isConnected } = useWebSocket();
  const [refreshKey, setRefreshKey] = useState(0);

  // Redirect SuperAdmin to admin dashboard
  useEffect(() => {
    if (user?.role === 'superadmin') {
      router.push('/admin');
    }
  }, [user, router]);

  // Handle transaction updates
  const handleTransactionUpdate = useCallback((message: any) => {
    console.log('Transaction update:', message);
    toast.info(`Transaction ${message.action}: ${message.data.id || 'New'}`, {
      description: 'Dashboard data has been updated',
    });
    // Trigger refresh of dashboard data
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle cash balance updates
  const handleCashBalanceUpdate = useCallback((message: any) => {
    console.log('Cash balance update:', message);
    toast.info('Cash balance updated', {
      description: 'Your cash balances have been updated',
    });
    // Trigger refresh of cash balance
    setRefreshKey(prev => prev + 1);
  }, []);

  // Subscribe to updates
  useTransactionUpdates(handleTransactionUpdate);
  useCashBalanceUpdates(handleCashBalanceUpdate);

  const isTrialExpired = user?.status === 'trial_expired';
  const isLicenseExpired = user?.status === 'license_expired';
  const needsActivation = isTrialExpired || isLicenseExpired;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview for {user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveIndicator isConnected={isConnected} />
          <AdvancedSearchDialog />
          <SavedSearchesDialog />
        </div>
      </div>

      {/* Warning for expired trial/license - Centered */}
      {needsActivation && (
        <div className="flex justify-center">
          <Card className="border-destructive bg-destructive/10 max-w-2xl w-full">
            <CardHeader className="flex flex-col items-center justify-center text-center min-h-[120px] py-6">
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">
                  {isTrialExpired ? 'Trial Period Expired' : 'License Expired'}
                </CardTitle>
              </div>
              <CardDescription className="text-center mt-2">
                You need to activate a license to use the system
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Top Row: Market Rates - Now at the top as requested */}
      <BuySellRatesWidget key={`rates-${refreshKey}`} />

      {/* Middle Row: Cash Balance (Priority) & Quick Convert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardCashBalance key={`balance-${refreshKey}`} />
        </div>
        <div className="lg:col-span-1">
          <QuickConvertWidget />
        </div>
      </div>

      {/* Bottom Row: Recent Activity */}
      <div className="grid grid-cols-1">
        <RecentActivityFeed key={`activity-${refreshKey}`} />
      </div>
    </div>
  );
}
