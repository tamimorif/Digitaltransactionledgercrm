'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import {
    useGetProfitAnalysis,
    useGetProfitByBranch,
    useGetProfitTrend,
    useGetTopCustomers,
} from '@/src/lib/queries/dashboard.query';
import { ProfitFilters } from '@/src/lib/models/dashboard.model';
import { formatNumber, formatCurrency } from '@/src/lib/format';
import { cn } from '@/src/lib/utils';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    BarChart3,
    Users,
    Building,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';

interface ProfitAnalysisDashboardProps {
    branchId?: number;
}

export function ProfitAnalysisDashboard({ branchId }: ProfitAnalysisDashboardProps) {
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
    const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});

    const filters: ProfitFilters = {
        branchId,
        startDate: dateRange.start,
        endDate: dateRange.end,
    };

    const { data: analysis, isLoading: analysisLoading } = useGetProfitAnalysis(filters);
    const { data: branchProfits, isLoading: branchLoading } = useGetProfitByBranch(filters);
    const { data: profitTrend, isLoading: trendLoading } = useGetProfitTrend(period, filters);
    const { data: topCustomers, isLoading: customersLoading } = useGetTopCustomers(10, filters);

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ProfitOverviewCard
                    title="Total Profit"
                    value={analysis?.totalProfitCAD ?? 0}
                    subtitle={`${analysis?.totalSettlements ?? 0} settlements`}
                    icon={DollarSign}
                    isLoading={analysisLoading}
                />
                <ProfitOverviewCard
                    title="Average per Settlement"
                    value={analysis?.averageProfitPerSettlement ?? 0}
                    subtitle="Per transaction"
                    icon={BarChart3}
                    isLoading={analysisLoading}
                />
                <ProfitOverviewCard
                    title="Outgoing Profit"
                    value={analysis?.profitByDirection?.outgoing ?? 0}
                    subtitle="From Canada to Iran"
                    icon={ArrowUpRight}
                    isLoading={analysisLoading}
                />
                <ProfitOverviewCard
                    title="Incoming Profit"
                    value={analysis?.profitByDirection?.incoming ?? 0}
                    subtitle="From Iran to Canada"
                    icon={ArrowDownRight}
                    isLoading={analysisLoading}
                />
            </div>

            {/* Tabs for different views */}
            <Tabs defaultValue="trend" className="space-y-4">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="trend">
                            <Calendar className="h-4 w-4 mr-2" />
                            Trend
                        </TabsTrigger>
                        <TabsTrigger value="branches">
                            <Building className="h-4 w-4 mr-2" />
                            By Branch
                        </TabsTrigger>
                        <TabsTrigger value="customers">
                            <Users className="h-4 w-4 mr-2" />
                            Top Customers
                        </TabsTrigger>
                    </TabsList>

                    <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Daily</SelectItem>
                            <SelectItem value="week">Weekly</SelectItem>
                            <SelectItem value="month">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Trend View */}
                <TabsContent value="trend">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profit Trend</CardTitle>
                            <CardDescription>
                                Profit over time ({period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'})
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {trendLoading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : !profitTrend || profitTrend.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No profit data available for this period
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {profitTrend.map((p) => {
                                        const maxProfit = Math.max(...profitTrend.map((x) => Math.abs(x.totalProfitCAD)));
                                        const width = maxProfit > 0 ? (Math.abs(p.totalProfitCAD) / maxProfit) * 100 : 0;
                                        const isPositive = p.totalProfitCAD >= 0;

                                        return (
                                            <div key={p.period} className="flex items-center gap-4">
                                                <div className="w-24 text-sm text-muted-foreground shrink-0">
                                                    {p.period}
                                                </div>
                                                <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden relative">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-lg transition-all",
                                                            isPositive ? "bg-green-500" : "bg-red-500"
                                                        )}
                                                        style={{ width: `${width}%` }}
                                                    />
                                                </div>
                                                <div className="w-28 text-right shrink-0">
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            isPositive ? "text-green-600" : "text-red-600"
                                                        )}
                                                    >
                                                        {isPositive ? '+' : ''}
                                                        {formatCurrency(p.totalProfitCAD, 'CAD')}
                                                    </span>
                                                </div>
                                                <Badge variant="outline" className="shrink-0">
                                                    {p.settlementCount}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Branch View */}
                <TabsContent value="branches">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profit by Branch</CardTitle>
                            <CardDescription>Compare performance across branches</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {branchLoading ? (
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))}
                                </div>
                            ) : !branchProfits || branchProfits.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No branch data available
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Branch</TableHead>
                                            <TableHead className="text-right">Settlements</TableHead>
                                            <TableHead className="text-right">Total Profit</TableHead>
                                            <TableHead className="text-right">Avg Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {branchProfits.map((branch) => (
                                            <TableRow key={branch.branchId}>
                                                <TableCell className="font-medium">
                                                    {branch.branchName}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {branch.settlementCount}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            branch.totalProfit >= 0
                                                                ? "text-green-600"
                                                                : "text-red-600"
                                                        )}
                                                    >
                                                        {formatCurrency(branch.totalProfit, 'CAD')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(branch.averageProfit, 'CAD')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Top Customers View */}
                <TabsContent value="customers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Customers by Profit</CardTitle>
                            <CardDescription>Most profitable customers</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {customersLoading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : !topCustomers || topCustomers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No customer data available
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead className="text-right">Transactions</TableHead>
                                            <TableHead className="text-right">Total Profit</TableHead>
                                            <TableHead className="text-right">Avg Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topCustomers.map((customer, index) => (
                                            <TableRow key={customer.customerId}>
                                                <TableCell>
                                                    <Badge
                                                        variant={index < 3 ? 'default' : 'outline'}
                                                        className={cn(
                                                            index === 0 && "bg-yellow-500",
                                                            index === 1 && "bg-gray-400",
                                                            index === 2 && "bg-amber-600"
                                                        )}
                                                    >
                                                        {index + 1}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {customer.customerName}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {customer.transactionCount}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            customer.totalProfit >= 0
                                                                ? "text-green-600"
                                                                : "text-red-600"
                                                        )}
                                                    >
                                                        {formatCurrency(customer.totalProfit, 'CAD')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(customer.averageProfit, 'CAD')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Top Currencies */}
            {analysis?.topProfitableCurrencies && analysis.topProfitableCurrencies.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Top Currency Pairs</CardTitle>
                        <CardDescription>Most profitable currency exchanges</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {analysis.topProfitableCurrencies.map((currency) => (
                                <div
                                    key={currency.currency}
                                    className="p-4 rounded-lg border bg-muted/50"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge>{currency.currency}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {currency.count} trades
                                        </span>
                                    </div>
                                    <div
                                        className={cn(
                                            "text-lg font-bold",
                                            currency.profit >= 0 ? "text-green-600" : "text-red-600"
                                        )}
                                    >
                                        {formatCurrency(currency.profit, 'CAD')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

interface ProfitOverviewCardProps {
    title: string;
    value: number;
    subtitle: string;
    icon: React.ElementType;
    isLoading: boolean;
}

function ProfitOverviewCard({ title, value, subtitle, icon: Icon, isLoading }: ProfitOverviewCardProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-3 w-16 mt-2" />
                </CardContent>
            </Card>
        );
    }

    const isPositive = value >= 0;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2">
                    {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span
                        className={cn(
                            "text-2xl font-bold",
                            isPositive ? "text-green-600" : "text-red-600"
                        )}
                    >
                        {formatCurrency(value, 'CAD')}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </CardContent>
        </Card>
    );
}
