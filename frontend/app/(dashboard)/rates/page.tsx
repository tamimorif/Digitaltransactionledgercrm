'use client';

import { useState } from 'react';
import {
    useGetRates,
    useRefreshRates,
    useSetCustomRate,
    useGetRateHistory,
    type ExchangeRate,
} from '@/src/lib/queries/exchange-rate.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/src/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { RefreshCw, Plus, Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function RatesPage() {
    const [openCustom, setOpenCustom] = useState(false);
    const [baseCurrency, setBaseCurrency] = useState('USD');
    const [targetCurrency, setTargetCurrency] = useState('CAD');
    const [customRate, setCustomRate] = useState('');

    const { data: rates, isLoading } = useGetRates();
    const refreshRates = useRefreshRates();
    const setCustomRateMutation = useSetCustomRate();

    const handleRefreshRates = () => {
        refreshRates.mutate('USD', {
            onSuccess: () => {
                toast.success('Exchange rates updated from API');
            },
            onError: () => {
                toast.error('Failed to refresh rates');
            },
        });
    };

    const handleSetCustomRate = () => {
        const rate = parseFloat(customRate);
        if (isNaN(rate) || rate <= 0) {
            toast.error('Please enter a valid rate');
            return;
        }

        setCustomRateMutation.mutate(
            { baseCurrency, targetCurrency, rate },
            {
                onSuccess: () => {
                    toast.success(`Custom rate set: 1 ${baseCurrency} = ${rate} ${targetCurrency}`);
                    setOpenCustom(false);
                    setCustomRate('');
                },
                onError: () => {
                    toast.error('Failed to set custom rate');
                },
            }
        );
    };

    // Group rates by base currency
    const groupedRates = rates?.reduce((acc: Record<string, ExchangeRate[]>, rate) => {
        if (!acc[rate.baseCurrency]) {
            acc[rate.baseCurrency] = [];
        }
        acc[rate.baseCurrency].push(rate);
        return acc;
    }, {});

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Exchange Rates</h1>
                    <p className="text-gray-500 mt-1">Manage currency exchange rates</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleRefreshRates} disabled={refreshRates.isPending} variant="outline">
                        {refreshRates.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Refresh from API
                    </Button>
                    <Dialog open={openCustom} onOpenChange={setOpenCustom}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Set Custom Rate
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Set Custom Exchange Rate</DialogTitle>
                                <DialogDescription>Override API rate with your custom rate</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="baseCurrency">Base Currency</Label>
                                        <Input
                                            id="baseCurrency"
                                            value={baseCurrency}
                                            onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                                            placeholder="USD"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="targetCurrency">Target Currency</Label>
                                        <Input
                                            id="targetCurrency"
                                            value={targetCurrency}
                                            onChange={(e) => setTargetCurrency(e.target.value.toUpperCase())}
                                            placeholder="CAD"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="rate">Exchange Rate</Label>
                                    <Input
                                        id="rate"
                                        type="number"
                                        step="0.0001"
                                        value={customRate}
                                        onChange={(e) => setCustomRate(e.target.value)}
                                        placeholder="1.3500"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSetCustomRate} disabled={setCustomRateMutation.isPending}>
                                    {setCustomRateMutation.isPending && (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    )}
                                    Set Rate
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : !rates || rates.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <TrendingUp className="h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Exchange Rates Yet</h3>
                        <p className="text-sm text-gray-500 text-center mb-6 max-w-md">
                            Get started by fetching the latest exchange rates from our API or set custom rates manually.
                        </p>
                        <div className="flex gap-3">
                            <Button onClick={handleRefreshRates} disabled={refreshRates.isPending}>
                                {refreshRates.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Fetch Rates from API
                            </Button>
                            <Button variant="outline" onClick={() => setOpenCustom(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Set Custom Rate
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {Object.entries(groupedRates || {}).map(([base, ratesList]) => (
                        <Card key={base} className="overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-blue-600" />
                                    {base} Exchange Rates
                                    <Badge variant="outline" className="ml-auto">{ratesList.length} currencies</Badge>
                                </CardTitle>
                                <CardDescription>
                                    Latest exchange rates for {base}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Target Currency</TableHead>
                                            <TableHead>Exchange Rate</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Last Updated</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ratesList.slice(0, 10).map((rate) => (
                                            <TableRow key={rate.id} className="hover:bg-gray-50">
                                                <TableCell className="font-semibold">{rate.targetCurrency}</TableCell>
                                                <TableCell className="font-mono text-lg">{rate.rate.toFixed(4)}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={rate.source === 'API' ? 'default' : 'secondary'}
                                                        className={rate.source === 'MANUAL' ? 'bg-amber-100 text-amber-700 border-amber-300' : ''}
                                                    >
                                                        {rate.source}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-500">
                                                    {new Date(rate.updatedAt).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
