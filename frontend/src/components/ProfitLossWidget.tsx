'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, DollarSign, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
    date: string;
    totalVolume: Record<string, number>;
    totalFees: Record<string, number>;
    transactionCount: number;
}

export function ProfitLossWidget() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/analytics/daily', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch analytics');
            }

            const result = await response.json();
            setData(result);
            toast.success('Analytics updated');
        } catch (error) {
            console.error('Error fetching analytics:', error);
            toast.error('Failed to load analytics');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Daily Analytics
                </CardTitle>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchAnalytics}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent>
                {data ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-gray-500">Transactions Today</span>
                            <span className="text-xl font-bold">{data.transactionCount}</span>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                Fees Collected (Gross Profit)
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(data.totalFees).map(([currency, amount]) => (
                                    amount > 0 && (
                                        <div key={currency} className="bg-green-50 p-2 rounded text-sm flex justify-between">
                                            <span className="font-medium">{currency}</span>
                                            <span className="text-green-700 font-bold">{amount.toLocaleString()}</span>
                                        </div>
                                    )
                                ))}
                                {Object.keys(data.totalFees).length === 0 && (
                                    <p className="text-sm text-gray-400 col-span-2">No fees collected yet today.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium mb-2 text-gray-600">Total Volume Traded</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(data.totalVolume).map(([currency, amount]) => (
                                    amount > 0 && (
                                        <div key={currency} className="bg-gray-50 p-2 rounded text-sm flex justify-between">
                                            <span className="font-medium">{currency}</span>
                                            <span>{amount.toLocaleString()}</span>
                                        </div>
                                    )
                                ))}
                                {Object.keys(data.totalVolume).length === 0 && (
                                    <p className="text-sm text-gray-400 col-span-2">No transactions yet today.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-gray-300" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
