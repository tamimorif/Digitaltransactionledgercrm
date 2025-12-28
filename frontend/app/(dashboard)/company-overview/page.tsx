'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { useGetStatistics, useExportToCSV, useExportToJSON } from '@/src/lib/queries/statistics.query';
import { useGetUserBranches } from '@/src/lib/queries/branch.query';
import { FileSpreadsheet, FileJson, Calendar, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/src/components/ui/alert';

export default function CompanyOverviewPage() {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

    // Build filters
    const filters = {
        branchId: selectedBranchId === 'all' ? undefined : parseInt(selectedBranchId),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    };

    // Queries
    const { data: statistics, isLoading, error } = useGetStatistics(filters);
    const { data: branches } = useGetUserBranches();
    const exportCSV = useExportToCSV();
    const exportJSON = useExportToJSON();

    const handleExportCSV = () => {
        exportCSV.mutate(filters);
    };

    const handleExportJSON = () => {
        exportJSON.mutate(filters);
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedBranchId('all');
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Company Overview</h1>
                    <p className="text-muted-foreground">Transaction statistics and data exports</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Filter transactions by date range and branch</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="branch">Branch</Label>
                            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Branches</SelectItem>
                                    {branches?.map((branch) => (
                                        <SelectItem key={branch.id} value={branch.id.toString()}>
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClearFilters}>
                            Clear Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>Failed to load statistics. Please try again.</AlertDescription>
                </Alert>
            )}

            {/* Statistics Summary */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            </CardHeader>
                            <CardContent className="animate-pulse">
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : statistics ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Total Count */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{statistics.totalCount}</div>
                                <p className="text-xs text-muted-foreground">{statistics.dateRange}</p>
                            </CardContent>
                        </Card>

                        {/* Average Amount */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">${statistics.averageAmount.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">Per transaction</p>
                            </CardContent>
                        </Card>

                        {/* Total Volume */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {Object.entries(statistics.totalVolumeByCurrency).map(([currency, amount]) => (
                                        <div key={currency} className="flex justify-between items-center">
                                            <span className="text-sm font-medium">{currency}</span>
                                            <span className="text-lg font-bold">{amount.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Date Range */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Date Range</CardTitle>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm font-medium">{statistics.dateRange}</div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {selectedBranchId === 'all' ? 'All branches' : 'Selected branch'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Breakdown by Type and Currency */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* By Type */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Transactions by Type</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(statistics.countByType).map(([type, count]) => (
                                        <div key={type} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                <span className="text-sm font-medium">{type.replace(/_/g, ' ')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">
                                                    ({((count / statistics.totalCount) * 100).toFixed(1)}%)
                                                </span>
                                                <span className="text-lg font-bold">{count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* By Currency */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Transactions by Currency</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(statistics.countByCurrency).map(([currency, count]) => (
                                        <div key={currency} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                <span className="text-sm font-medium">{currency}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">
                                                    ({((count / statistics.totalCount) * 100).toFixed(1)}%)
                                                </span>
                                                <span className="text-lg font-bold">{count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Export Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Export Data</CardTitle>
                            <CardDescription>Download transaction data in your preferred format</CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-4">
                            <Button
                                onClick={handleExportCSV}
                                disabled={exportCSV.isPending}
                                className="flex items-center gap-2"
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                {exportCSV.isPending ? 'Exporting...' : 'Export to CSV'}
                            </Button>
                            <Button
                                onClick={handleExportJSON}
                                disabled={exportJSON.isPending}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <FileJson className="h-4 w-4" />
                                {exportJSON.isPending ? 'Exporting...' : 'Export to JSON'}
                            </Button>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
