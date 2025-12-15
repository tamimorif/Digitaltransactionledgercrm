'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Badge } from '@/src/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/src/contexts/TranslationContext';

interface OutgoingRemittance {
    id: number;
    senderName: string;
    amountIrr: number;
    remainingIrr: number;
    buyRateCad: number;
    status: string;
}

interface IncomingRemittance {
    id: number;
    senderName: string;
    amountIrr: number;
    remainingIrr: number;
    sellRateCad: number;
    status: string;
}

interface SettlementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    outgoingRemittances: OutgoingRemittance[];
    incomingRemittances: IncomingRemittance[];
    onSettlementCreated?: () => void;
}

export function SettlementDialog({
    open,
    onOpenChange,
    outgoingRemittances,
    incomingRemittances,
    onSettlementCreated,
}: SettlementDialogProps) {
    const { t } = useTranslation();
    const [outgoingId, setOutgoingId] = useState<string>('');
    const [incomingId, setIncomingId] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate profit/loss preview
    const calculateProfit = () => {
        if (!outgoingId || !incomingId || !amount) return null;

        const outgoing = outgoingRemittances.find(r => r.id === parseInt(outgoingId));
        const incoming = incomingRemittances.find(r => r.id === parseInt(incomingId));
        const settlementAmount = parseFloat(amount);

        if (!outgoing || !incoming || isNaN(settlementAmount)) return null;

        const cost = settlementAmount / outgoing.buyRateCad;
        const revenue = settlementAmount / incoming.sellRateCad;
        const profit = cost - revenue;

        return {
            cost,
            revenue,
            profit,
            isProfit: profit > 0,
        };
    };

    const handleSubmit = async () => {
        if (!outgoingId || !incomingId || !amount) {
            toast.error(t('cashBalance.fillAllFields'));
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/remittances/settlements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                },
                body: JSON.stringify({
                    outgoingRemittanceId: parseInt(outgoingId),
                    incomingRemittanceId: parseInt(incomingId),
                    settlementAmount: parseFloat(amount),
                    notes: notes || undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create settlement');
            }

            toast.success('Settlement created successfully!');
            onOpenChange(false);
            if (onSettlementCreated) {
                onSettlementCreated();
            }

            // Reset form
            setOutgoingId('');
            setIncomingId('');
            setAmount('');
            setNotes('');
        } catch (error) {
            console.error('Settlement creation error:', error);
            toast.error('Failed to create settlement');
        } finally {
            setIsSubmitting(false);
        }
    };

    const profitCalc = calculateProfit();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('settlement.create')}</DialogTitle>
                    <DialogDescription>
                        Link an incoming remittance to settle an outgoing remittance
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Outgoing Remittance */}
                    <div className="grid gap-2">
                        <Label htmlFor="outgoing">{t('settlement.outgoing')}</Label>
                        <Select value={outgoingId} onValueChange={setOutgoingId}>
                            <SelectTrigger id="outgoing">
                                <SelectValue placeholder="Select outgoing remittance..." />
                            </SelectTrigger>
                            <SelectContent>
                                {outgoingRemittances.map((remittance) => (
                                    <SelectItem key={remittance.id} value={remittance.id.toString()}>
                                        <div className="flex items-center justify-between w-full">
                                            <span>{remittance.senderName}</span>
                                            <Badge variant="secondary" className="ml-2">
                                                {t('settlement.remaining')}: {remittance.remainingIrr.toLocaleString()} IRR
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Incoming Remittance */}
                    <div className="grid gap-2">
                        <Label htmlFor="incoming">{t('settlement.incoming')}</Label>
                        <Select value={incomingId} onValueChange={setIncomingId}>
                            <SelectTrigger id="incoming">
                                <SelectValue placeholder="Select incoming remittance..." />
                            </SelectTrigger>
                            <SelectContent>
                                {incomingRemittances.map((remittance) => (
                                    <SelectItem key={remittance.id} value={remittance.id.toString()}>
                                        <div className="flex items-center justify-between w-full">
                                            <span>{remittance.senderName}</span>
                                            <Badge variant="secondary" className="ml-2">
                                                {remittance.remainingIrr.toLocaleString()} IRR
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Settlement Amount */}
                    <div className="grid gap-2">
                        <Label htmlFor="amount">{t('settlement.amount')} (IRR)</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="Enter amount in IRR..."
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    {/* Profit/Loss Preview */}
                    {profitCalc && (
                        <div className="p-4 bg-muted rounded-lg">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground">Cost</div>
                                    <div className="font-semibold">${profitCalc.cost.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Revenue</div>
                                    <div className="font-semibold">${profitCalc.revenue.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">
                                        {profitCalc.isProfit ? t('settlement.profit') : t('settlement.loss')}
                                    </div>
                                    <div className={`font-semibold flex items-center gap-1 ${profitCalc.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                        {profitCalc.isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                        ${Math.abs(profitCalc.profit).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="grid gap-2">
                        <Label htmlFor="notes">{t('settlement.notes')}</Label>
                        <Textarea
                            id="notes"
                            placeholder={t('settlement.addNotes')}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('common.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
