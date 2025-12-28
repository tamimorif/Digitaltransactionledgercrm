'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useTranslation } from '@/src/contexts/TranslationContext';

interface Settlement {
    id: number;
    outgoingRemittance?: {
        senderName: string;
    };
    incomingRemittance?: {
        senderName: string;
    };
    settledAmountIrr: number;
    outgoingBuyRate: number;
    incomingSellRate: number;
    profitCad: number;
    createdAt: string;
    notes?: string;
}

interface SettlementHistoryTableProps {
    settlements: Settlement[];
}

export function SettlementHistoryTable({ settlements }: SettlementHistoryTableProps) {
    const { t } = useTranslation();

    if (!settlements || settlements.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('settlement.history')}</CardTitle>
                    <CardDescription>No settlements found</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const totalProfit = settlements.reduce((sum, s) => sum + s.profitCad, 0);
    const totalSettled = settlements.reduce((sum, s) => sum + s.settledAmountIrr, 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>{t('settlement.history')}</CardTitle>
                        <CardDescription>{settlements.length} settlements</CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-muted-foreground">{t('settlement.total')} {t('settlement.profit')}</div>
                        <div className={`text-2xl font-bold flex items-center justify-end gap-2 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                            ${Math.abs(totalProfit).toFixed(2)}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>From/To</TableHead>
                            <TableHead className="text-right">{t('settlement.amount')}</TableHead>
                            <TableHead className="text-right">Buy Rate</TableHead>
                            <TableHead className="text-right">Sell Rate</TableHead>
                            <TableHead className="text-right">{t('settlement.profit')}/{t('settlement.loss')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {settlements.map((settlement) => (
                            <TableRow key={settlement.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        {new Date(settlement.createdAt).toLocaleDateString()}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {settlement.outgoingRemittance && (
                                            <div className="text-sm">
                                                <Badge variant="outline" className="mr-1">OUT</Badge>
                                                {settlement.outgoingRemittance.senderName}
                                            </div>
                                        )}
                                        {settlement.incomingRemittance && (
                                            <div className="text-sm">
                                                <Badge variant="outline" className="mr-1">IN</Badge>
                                                {settlement.incomingRemittance.senderName}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {settlement.settledAmountIrr.toLocaleString()} IRR
                                </TableCell>
                                <TableCell className="text-right">
                                    {settlement.outgoingBuyRate.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    {settlement.incomingSellRate.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={settlement.profitCad >= 0 ? 'default' : 'destructive'}>
                                        {settlement.profitCad >= 0 ? '+' : ''}${settlement.profitCad.toFixed(2)}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Summary Row */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        {t('settlement.total')} {t('settlement.settled')}: <span className="font-semibold text-foreground">{totalSettled.toLocaleString()} IRR</span>
                    </div>
                    <div className="text-sm">
                        {t('settlement.total')} {t('settlement.profit')}:
                        <span className={`ml-2 font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(totalProfit).toFixed(2)}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
