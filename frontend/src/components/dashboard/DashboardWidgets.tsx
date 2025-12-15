'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import {
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Users,
    ArrowLeftRight,
    Clock,
    AlertTriangle,
    AlertCircle,
    Info,
    Loader2,
} from 'lucide-react';
import { useGetDashboardData } from '@/src/lib/queries/dashboard.query';
import { formatNumber, formatCurrency } from '@/src/lib/format';
import { cn } from '@/src/lib/utils';

interface DashboardWidgetsProps {
    branchId?: number;
}

export function DashboardWidgets({ branchId }: DashboardWidgetsProps) {
    const { data: dashboard, isLoading, error } = useGetDashboardData(branchId);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Failed to load dashboard data. Please try again.</AlertDescription>
            </Alert>
        );
    }

    if (!dashboard) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Alerts Section */}
            {dashboard.alerts.length > 0 && (
                <div className="space-y-2">
                    {dashboard.alerts.slice(0, 3).map((alert, index) => (
                        <Alert
                            key={index}
                            variant={alert.type === 'error' ? 'destructive' : 'default'}
                            className={cn(
                                alert.type === 'warning' && 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
                                alert.type === 'info' && 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                            )}
                        >
                            {alert.type === 'error' && <AlertCircle className="h-4 w-4" />}
                            {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                            {alert.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
                            <AlertTitle>{alert.title}</AlertTitle>
                            <AlertDescription>{alert.message}</AlertDescription>
                        </Alert>
                    ))}
                </div>
            )}

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Today's Profit */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Profit</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(dashboard.todayMetrics.profitCad, 'CAD')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {dashboard.todayMetrics.transactionCount} transactions
                        </p>
                    </CardContent>
                </Card>

                {/* Active Remittances */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Remittances</CardTitle>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard.activeRemittancesCount}</div>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center">
                                <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                                {dashboard.outgoingSummary.pendingCount + dashboard.outgoingSummary.partialCount} out
                            </span>
                            <span className="flex items-center">
                                <ArrowDownRight className="h-3 w-3 mr-1 text-blue-500" />
                                {dashboard.incomingSummary.pendingCount + dashboard.incomingSummary.partialCount} in
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Pickups */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Pickups</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard.pendingPickupsCount}</div>
                        <p className="text-xs text-muted-foreground">Awaiting customer pickup</p>
                    </CardContent>
                </Card>

                {/* Total Clients */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard.totalClientsCount}</div>
                        <p className="text-xs text-muted-foreground">
                            +{dashboard.todayMetrics.newCustomers} today
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Remittance Summaries */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Outgoing Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowUpRight className="h-5 w-5 text-green-500" />
                            Outgoing Remittances
                        </CardTitle>
                        <CardDescription>Money sent to Iran</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Pending</span>
                                <Badge variant="outline">{dashboard.outgoingSummary.pendingCount}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Partial</span>
                                <Badge variant="secondary">{dashboard.outgoingSummary.partialCount}</Badge>
                            </div>
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Total Pending (CAD)</span>
                                    <span className="font-bold">
                                        {formatCurrency(dashboard.outgoingSummary.totalPendingCad, 'CAD')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm font-medium">Remaining (IRR)</span>
                                    <span className="font-bold text-sm">
                                        {formatNumber(dashboard.outgoingSummary.totalRemainingIrr)} ریال
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Incoming Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowDownRight className="h-5 w-5 text-blue-500" />
                            Incoming Remittances
                        </CardTitle>
                        <CardDescription>Money received from Iran</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Pending</span>
                                <Badge variant="outline">{dashboard.incomingSummary.pendingCount}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Partial</span>
                                <Badge variant="secondary">{dashboard.incomingSummary.partialCount}</Badge>
                            </div>
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Total Pending (CAD)</span>
                                    <span className="font-bold">
                                        {formatCurrency(dashboard.incomingSummary.totalPendingCad, 'CAD')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm font-medium">Remaining (IRR)</span>
                                    <span className="font-bold text-sm">
                                        {formatNumber(dashboard.incomingSummary.totalRemainingIrr)} ریال
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Cash Balances */}
            {dashboard.cashBalances.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Cash on Hand
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {dashboard.cashBalances.map((balance) => (
                                <div
                                    key={balance.currency}
                                    className="p-3 rounded-lg border bg-muted/50 text-center"
                                >
                                    <div className="text-sm font-medium text-muted-foreground">
                                        {balance.currency}
                                    </div>
                                    <div className="text-lg font-bold mt-1">
                                        {formatNumber(balance.balance)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Period Comparison */}
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    title="Today"
                    metrics={dashboard.todayMetrics}
                />
                <MetricCard
                    title="This Week"
                    metrics={dashboard.weekMetrics}
                />
                <MetricCard
                    title="This Month"
                    metrics={dashboard.monthMetrics}
                />
            </div>
        </div>
    );
}

interface MetricCardProps {
    title: string;
    metrics: {
        transactionCount: number;
        transactionVolume: number;
        newCustomers: number;
        profitCad: number;
    };
}

function MetricCard({ title, metrics }: MetricCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Transactions</span>
                    <span className="font-medium">{metrics.transactionCount}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Volume</span>
                    <span className="font-medium">{formatCurrency(metrics.transactionVolume, 'CAD')}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">New Customers</span>
                    <span className="font-medium">{metrics.newCustomers}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium">Profit</span>
                    <span className={cn(
                        "font-bold",
                        metrics.profitCad >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                        {formatCurrency(metrics.profitCad, 'CAD')}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-3 w-16 mt-2" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
