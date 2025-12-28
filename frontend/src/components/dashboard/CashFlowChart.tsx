'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { DashboardSummaryCashFlowPoint } from '@/src/lib/models/dashboard.model';
import {
    Line,
    LineChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { format } from 'date-fns';

interface CashFlowChartProps {
    data: DashboardSummaryCashFlowPoint[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle>Cash Flow</CardTitle>
                    <CardDescription>Income vs Outgoing Volume (30 Days)</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] flex items-center justify-center text-muted-foreground">
                    No data available
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Cash Flow</CardTitle>
                <CardDescription>Income vs Outgoing Volume (30 Days)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => format(new Date(str), 'MMM d')}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                                fontSize={12}
                            />
                            <YAxis
                                tickFormatter={(value) => `$${value}`}
                                tickLine={false}
                                axisLine={false}
                                fontSize={12}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                labelFormatter={(label) => format(new Date(label), 'MMMM d, yyyy')}
                                formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                            />
                            <Line
                                type="monotone"
                                dataKey="in"
                                name="In"
                                stroke="#16a34a"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="out"
                                name="Out"
                                stroke="#64748b"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
