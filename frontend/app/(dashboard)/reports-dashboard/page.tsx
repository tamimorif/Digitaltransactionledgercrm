'use client';

import { useMemo, useState } from 'react';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
  useGetDailyReport,
  useGetMonthlyReport,
  useGetCustomReport,
  type ReportData,
} from '@/src/lib/queries/report.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { BarChart3, DollarSign, Users, Building2 } from 'lucide-react';
import { cn } from '@/src/components/ui/utils';

const reportTypes = [
  { id: 'profit', label: 'Profit', icon: DollarSign, description: 'Revenue and margin overview' },
  { id: 'volume', label: 'Volume', icon: BarChart3, description: 'Currency volume breakdown' },
  { id: 'customers', label: 'Customers', icon: Users, description: 'Top customer performance' },
  { id: 'branches', label: 'Branches', icon: Building2, description: 'Branch-level performance' },
] as const;

type ReportType = (typeof reportTypes)[number]['id'];

export default function ReportsDashboardPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [monthlyYear, setMonthlyYear] = useState<number>(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState<number>(new Date().getMonth() + 1);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState('daily');
  const [activeReportType, setActiveReportType] = useState<ReportType>('profit');

  const { data: branches } = useGetBranches();
  const branchId = selectedBranch === 'all' ? undefined : Number(selectedBranch);

  const { data: dailyReport, isLoading: dailyLoading } = useGetDailyReport(dailyDate, branchId);
  const { data: monthlyReport, isLoading: monthlyLoading } = useGetMonthlyReport(
    monthlyYear,
    monthlyMonth,
    branchId
  );
  const { data: customReport, isLoading: customLoading } = useGetCustomReport(
    customStartDate,
    customEndDate,
    branchId
  );

  const currentReport =
    activeTab === 'daily' ? dailyReport : activeTab === 'monthly' ? monthlyReport : customReport;
  const isLoading = activeTab === 'daily' ? dailyLoading : activeTab === 'monthly' ? monthlyLoading : customLoading;

  const summaryMetric = useMemo(() => {
    if (!currentReport) return { label: 'Total', value: 0, subLabel: '' };

    const totalVolume = Object.values(currentReport.totalVolume || {}).reduce((sum, v) => sum + v, 0);

    switch (activeReportType) {
      case 'profit':
        return {
          label: 'Total Revenue',
          value: currentReport.totalRevenue,
          subLabel: `Fees collected: $${currentReport.totalFees.toFixed(2)}`,
        };
      case 'volume':
        return {
          label: 'Total Volume',
          value: totalVolume,
          subLabel: 'Aggregated across currencies',
        };
      case 'customers':
        return {
          label: 'Top Customers',
          value: currentReport.topCustomers?.length || 0,
          subLabel: `${currentReport.totalTransactions} total transactions`,
        };
      case 'branches':
        return {
          label: 'Reporting Branches',
          value: currentReport.branchPerformance?.length || 0,
          subLabel: `Total revenue: $${currentReport.totalRevenue.toFixed(2)}`,
        };
      default:
        return { label: 'Total', value: 0, subLabel: '' };
    }
  }, [activeReportType, currentReport]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-6 font-[Inter]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports Dashboard</h1>
          <p className="text-muted-foreground mt-1">Clean, printable insights by report type</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <Card className="h-fit border-border/60 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Report Types</CardTitle>
            <CardDescription className="text-xs">Switch views instantly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isActive = activeReportType === type.id;
              return (
                <Button
                  key={type.id}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full items-start justify-start gap-3 px-3 py-2 text-left',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                      : 'hover:bg-muted/60'
                  )}
                  onClick={() => setActiveReportType(type.id)}
                >
                  <Icon className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Report Filters</CardTitle>
                <CardDescription className="text-xs">Pick branch and time window</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Branches" />
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
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted/40 p-1">
                      <TabsTrigger value="daily">Daily</TabsTrigger>
                      <TabsTrigger value="monthly">Monthly</TabsTrigger>
                      <TabsTrigger value="custom">Custom</TabsTrigger>
                    </TabsList>

                    <TabsContent value="daily" className="space-y-2 mt-4">
                      <Label htmlFor="dailyDate">Select Date</Label>
                      <Input
                        id="dailyDate"
                        type="date"
                        value={dailyDate}
                        onChange={(e) => setDailyDate(e.target.value)}
                      />
                    </TabsContent>

                    <TabsContent value="monthly" className="space-y-2 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="year">Year</Label>
                          <Input
                            id="year"
                            type="number"
                            value={monthlyYear}
                            onChange={(e) => setMonthlyYear(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="month">Month</Label>
                          <Select
                            value={String(monthlyMonth)}
                            onValueChange={(v) => setMonthlyMonth(Number(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(12)].map((_, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>
                                  {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="custom" className="space-y-2 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endDate">End Date</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  {summaryMetric.label}
                </CardTitle>
                <CardDescription className="text-xs">{summaryMetric.subLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline" className="w-fit">
                  {reportTypes.find((t) => t.id === activeReportType)?.label}
                </Badge>
                <div className="text-3xl font-bold">
                  {activeReportType === 'customers' || activeReportType === 'branches'
                    ? summaryMetric.value.toLocaleString()
                    : `$${summaryMetric.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {reportTypes.find((t) => t.id === activeReportType)?.label} Report
              </CardTitle>
              <CardDescription className="text-xs">Striped rows for quick scanning</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">Loading report...</div>
              ) : !currentReport ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">No data available.</div>
              ) : (
                renderReportTable(activeReportType, currentReport)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function renderReportTable(type: ReportType, report: ReportData) {
  if (type === 'volume') {
    const volumeRows = Object.entries(report.totalVolume || {});
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {volumeRows.map(([currency, volume], index) => (
            <TableRow key={currency} className={index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}>
              <TableCell className="font-medium">{currency}</TableCell>
              <TableCell className="text-right font-mono">{volume.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === 'customers') {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Transactions</TableHead>
            <TableHead className="text-right">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.topCustomers?.map((customer, index) => (
            <TableRow
              key={customer.clientId}
              className={index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}
            >
              <TableCell>
                <Badge variant="outline">{index + 1}</Badge>
              </TableCell>
              <TableCell className="font-medium">{customer.clientName}</TableCell>
              <TableCell className="text-right">{customer.txCount}</TableCell>
              <TableCell className="text-right font-mono">${customer.volume.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Transactions</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.branchPerformance?.map((branch, index) => (
          <TableRow key={branch.branchId} className={index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}>
            <TableCell className="font-medium">{branch.branchName}</TableCell>
            <TableCell className="text-right">{branch.txCount}</TableCell>
            <TableCell className="text-right font-mono">${branch.revenue.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
