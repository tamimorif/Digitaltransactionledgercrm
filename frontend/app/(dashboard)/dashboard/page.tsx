'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useDashboardData } from '@/src/queries/dashboard.query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';
import { getErrorMessage } from '@/src/lib/error';
import { cn } from '@/src/components/ui/utils';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  RefreshCcw,
  Wallet,
} from 'lucide-react';
import { CashFlowChart } from '@/src/components/dashboard/CashFlowChart';
import { QuickConvertWidget } from '@/src/components/dashboard/QuickConvertWidget';
import { CreateTransferDialog } from '@/src/components/transfers/CreateTransferDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    data: dashboard,
    isLoading,
    isFetching,
    isError,
    status,
    fetchStatus,
    error,
    dataUpdatedAt,
    failureCount,
    refetch,
  } = useDashboardData(undefined, !!user);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      router.push('/admin');
    }
  }, [user, router]);

  const recentTransactions = useMemo(() => dashboard?.recentTransactions ?? [], [dashboard]);

  if (isLoading) {
    return (
      <>
        <DashboardSkeleton />
        <div className="mx-auto w-full max-w-7xl px-6 pb-6">
          <DashboardDebugPanel
            enabled={!!user}
            status={status}
            fetchStatus={fetchStatus}
            isFetching={isFetching}
            isLoading={isLoading}
            isError={isError}
            dataUpdatedAt={dataUpdatedAt}
            failureCount={failureCount}
            error={error}
            dashboard={dashboard}
          />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load dashboard data. Please try again.</AlertDescription>
          <Button onClick={() => refetch()} variant="outline" className="mt-2">
            Retry
          </Button>
        </Alert>
        <DashboardDebugPanel
          enabled={!!user}
          status={status}
          fetchStatus={fetchStatus}
          isFetching={isFetching}
          isLoading={isLoading}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          failureCount={failureCount}
          error={error}
          dashboard={dashboard}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-6 font-[Inter]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-12 gap-4">
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          title="Total Volume"
          value={`$${(dashboard?.kpis.totalVolumeToday ?? 0).toLocaleString()}`}
          label="Today"
          icon={Wallet}
        />
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          title="Profit"
          value={`$${(dashboard?.kpis.profitToday ?? 0).toLocaleString()}`}
          label="Today"
          icon={Activity}
          accent="text-emerald-600"
        />
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          title="Pending"
          value={`${dashboard?.kpis.pendingRemittances ?? 0}`}
          label="Remittances"
          icon={ArrowUpRight}
        />
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          title="Incoming"
          value={`${dashboard?.kpis.incomingPending ?? 0}`}
          label="To settle"
          icon={ArrowDownRight}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <CashFlowChart data={dashboard?.cashFlow ?? []} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
              <Link
                href="/company-overview"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                View All
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {recentTransactions.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No recent transactions available.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.slice(0, 6).map((tx, index) => (
                      <TableRow key={tx.id} className={index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}>
                        <TableCell className="font-medium">{tx.client}</TableCell>
                        <TableCell>
                          {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                          <span className="text-xs text-muted-foreground">{tx.currency}</span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <QuickConvertWidget compact />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr,1.15fr]">
              <div className="space-y-3">
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  New Transfer
                </Button>
                <Button
                  size="sm"
                  className="w-full"
                  variant="outline"
                  onClick={() => router.push('/send-pickup')}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Initiate Remittance
                </Button>
              </div>
              <div className="border-t border-dashed pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <DashboardDebugPanel
                  enabled={!!user}
                  status={status}
                  fetchStatus={fetchStatus}
                  isFetching={isFetching}
                  isLoading={isLoading}
                  isError={isError}
                  dataUpdatedAt={dataUpdatedAt}
                  failureCount={failureCount}
                  error={error}
                  dashboard={dashboard}
                  variant="inline"
                  compact
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  label: string;
  icon: React.ElementType;
  className?: string;
  accent?: string;
}

function StatCard({ title, value, label, icon: Icon, className, accent }: StatCardProps) {
  return (
    <Card className={cn('gap-2 border-border/60', className)}>
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-1 pt-4">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn('h-4 w-4 text-muted-foreground', accent)} />
      </CardHeader>
      <CardContent className="space-y-1 px-4 pb-4 pt-0">
        <div className={cn('text-xl font-semibold', accent)}>{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-12 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="col-span-12 sm:col-span-6 xl:col-span-3 h-20" />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-[240px] w-full" />
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Skeleton className="h-[260px] w-full" />
          <Skeleton className="h-[180px] w-full" />
        </div>
      </div>
    </div>
  );
}

type DashboardDebugPanelProps = {
  enabled: boolean;
  status: string;
  fetchStatus: string;
  isFetching: boolean;
  isLoading: boolean;
  isError: boolean;
  dataUpdatedAt: number;
  failureCount: number;
  error: unknown;
  dashboard: {
    kpis?: unknown;
    cashFlow?: unknown[];
    recentTransactions?: unknown[];
  } | null | undefined;
  variant?: 'card' | 'inline';
  compact?: boolean;
  className?: string;
};

function DashboardDebugPanel({
  enabled,
  status,
  fetchStatus,
  isFetching,
  isLoading,
  isError,
  dataUpdatedAt,
  failureCount,
  error,
  dashboard,
  variant = 'card',
  compact = false,
  className,
}: DashboardDebugPanelProps) {
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : 'never';
  const gridClass = compact
    ? 'grid grid-cols-2 gap-2 text-[11px] text-muted-foreground'
    : 'grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3';
  const errorClass = compact ? 'px-2 py-2 text-[11px]' : 'px-3 py-2 text-xs';

  const content = (
    <>
      <div className={gridClass}>
        <span>enabled: {enabled ? 'true' : 'false'}</span>
        <span>status: {status}</span>
        <span>fetch: {fetchStatus}</span>
        <span>fetching: {isFetching ? 'yes' : 'no'}</span>
        <span>loading: {isLoading ? 'yes' : 'no'}</span>
        <span>error: {isError ? 'yes' : 'no'}</span>
        <span>updated: {lastUpdated}</span>
        <span>failures: {failureCount}</span>
        <span>kpis: {dashboard?.kpis ? 'ok' : 'missing'}</span>
        <span>cashFlow: {dashboard?.cashFlow?.length ?? 0}</span>
        <span>recentTx: {dashboard?.recentTransactions?.length ?? 0}</span>
      </div>
      {isError && (
        <div className={cn('rounded-md border border-red-200 bg-red-50 text-red-700', errorClass)}>
          {getErrorMessage(error, 'Unknown dashboard error')}
        </div>
      )}
    </>
  );

  if (variant === 'inline') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Debug · Dashboard Fetch
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card className={cn('border-dashed bg-muted/30', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Debug · Dashboard Fetch
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-xs">{content}</CardContent>
    </Card>
  );
}
