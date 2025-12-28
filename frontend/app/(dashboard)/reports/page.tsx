'use client';

import { useState } from 'react';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import {
    useExportToCSV,
    useExportToJSON,
    useExportToPDF,
} from '@/src/lib/queries/statistics.query';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/src/components/ui/card';
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
import { FileText, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsPage() {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');

    const { data: branches } = useGetBranches();
    const exportCSV = useExportToCSV();
    const exportJSON = useExportToJSON();
    const exportPDF = useExportToPDF();

    const handleExport = (type: 'csv' | 'json' | 'pdf') => {
        const filters = {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            branchId: selectedBranch !== 'all' ? Number(selectedBranch) : undefined,
        };

        const options = {
            onSuccess: () => {
                toast.success(`Report downloaded successfully as ${type.toUpperCase()}`);
            },
            onError: () => {
                toast.error('Failed to download report');
            },
        };

        if (type === 'csv') {
            exportCSV.mutate(filters, options);
        } else if (type === 'json') {
            exportJSON.mutate(filters, options);
        } else {
            exportPDF.mutate(filters, options);
        }
    };

    const isExporting =
        exportCSV.isPending || exportJSON.isPending || exportPDF.isPending;

    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-6 font-[Inter]">
            <div>
                <h1 className="text-3xl font-bold">Reports</h1>
                <p className="text-muted-foreground mt-1">
                    Generate and download detailed transaction reports.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Configuration Card */}
                <Card className="border-2">
                    <CardHeader className="bg-muted/40">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Report Configuration
                        </CardTitle>
                        <CardDescription>
                            Select the criteria for your report.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
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

                        <div className="grid grid-cols-2 gap-4">
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
                        </div>
                    </CardContent>
                </Card>

                {/* Download Options Card */}
                <Card className="border-2">
                    <CardHeader className="bg-muted/40">
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-primary" />
                            Download Options
                        </CardTitle>
                        <CardDescription>
                            Choose a format to download your report.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-6">
                        <Button
                            variant="outline"
                            className="h-auto py-4 justify-start px-6 border-2 hover:border-border hover:bg-muted/40"
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting}
                        >
                            <FileText className="h-8 w-8 mr-4 text-red-500" />
                            <div className="text-left">
                                <div className="font-semibold text-base">PDF Report</div>
                                <div className="text-xs text-gray-500">
                                    Best for printing and sharing
                                </div>
                            </div>
                            {exportPDF.isPending && (
                                <Download className="ml-auto h-4 w-4 animate-bounce" />
                            )}
                        </Button>

                        <Button
                            variant="outline"
                            className="h-auto py-4 justify-start px-6 border-2 hover:border-border hover:bg-muted/40"
                            onClick={() => handleExport('csv')}
                            disabled={isExporting}
                        >
                            <FileSpreadsheet className="h-8 w-8 mr-4 text-green-500" />
                            <div className="text-left">
                                <div className="font-semibold text-base">CSV Export</div>
                                <div className="text-xs text-gray-500">
                                    Best for Excel and spreadsheet analysis
                                </div>
                            </div>
                            {exportCSV.isPending && (
                                <Download className="ml-auto h-4 w-4 animate-bounce" />
                            )}
                        </Button>

                        <Button
                            variant="outline"
                            className="h-auto py-4 justify-start px-6 border-2 hover:border-border hover:bg-muted/40"
                            onClick={() => handleExport('json')}
                            disabled={isExporting}
                        >
                            <FileJson className="h-8 w-8 mr-4 text-yellow-500" />
                            <div className="text-left">
                                <div className="font-semibold text-base">JSON Data</div>
                                <div className="text-xs text-gray-500">
                                    Best for programmatic processing
                                </div>
                            </div>
                            {exportJSON.isPending && (
                                <Download className="ml-auto h-4 w-4 animate-bounce" />
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
