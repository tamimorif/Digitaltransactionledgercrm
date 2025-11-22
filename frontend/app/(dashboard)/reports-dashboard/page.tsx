'use client';

import { useState } from 'react';
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
import { FileText, Download, Loader2, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsDashboardPage() {
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [monthlyYear, setMonthlyYear] = useState<number>(new Date().getFullYear());
    const [monthlyMonth, setMonthlyMonth] = useState<number>(new Date().getMonth() + 1);
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [activeTab, setActiveTab] = useState('daily');

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

    const handleDownloadPDF = () => {
        toast.info('PDF download feature - coming soon');
    };

    const handleEmailReport = () => {
        toast.info('Email report feature - coming soon');
    };

    const renderReportContent = (report: ReportData | undefined) => {
        if (!report) return null;

        return (
            <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{report.totalTransactions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${report.totalRevenue.toFixed(2)}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${report.totalFees.toFixed(2)}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Top Customers</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{report.topCustomers?.length || 0}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Volume by Currency */}
                <Card>
                    <CardHeader>
                        <CardTitle>Volume by Currency</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(report.totalVolume).map(([currency, volume]) => (
                                <div key={currency} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                    <Badge variant="outline">{currency}</Badge>
                                    <span className="font-semibold">{volume.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Customers */}
                {report.topCustomers && report.topCustomers.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Customers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer Name</TableHead>
                                        <TableHead>Transactions</TableHead>
                                        <TableHead>Total Volume</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.topCustomers.map((customer) => (
                                        <TableRow key={customer.clientId}>
                                            <TableCell className="font-medium">{customer.clientName}</TableCell>
                                            <TableCell>{customer.txCount}</TableCell>
                                            <TableCell>${customer.volume.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Branch Performance */}
                {report.branchPerformance && report.branchPerformance.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Branch Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Branch</TableHead>
                                        <TableHead>Transactions</TableHead>
                                        <TableHead>Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.branchPerformance.map((branch) => (
                                        <TableRow key={branch.branchId}>
                                            <TableCell className="font-medium">{branch.branchName}</TableCell>
                                            <TableCell>{branch.txCount}</TableCell>
                                            <TableCell>${branch.revenue.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports Dashboard</h1>
                    <p className="text-gray-500 mt-1">View detailed transaction reports and insights</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleDownloadPDF}>
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                    </Button>
                    <Button variant="outline" onClick={handleEmailReport}>
                        <FileText className="h-4 w-4 mr-2" />
                        Email Report
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Report Filters</CardTitle>
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
                                    {branches?.map((branch: any) => (
                                        <SelectItem key={branch.id} value={String(branch.id)}>
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="daily">Daily</TabsTrigger>
                                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                                <TabsTrigger value="custom">Custom Range</TabsTrigger>
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

            {/* Report Content */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : (
                renderReportContent(currentReport)
            )}
        </div>
    );
}
