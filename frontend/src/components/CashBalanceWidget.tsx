'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Wallet, Edit, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/src/lib/format';

interface CashBalance {
    [currency: string]: number;
}

export function CashBalanceWidget() {
    const { t } = useTranslation();
    const [balances, setBalances] = useState<CashBalance>({});
    const [isEditing, setIsEditing] = useState(false);
    const [editBalances, setEditBalances] = useState<CashBalance>({});

    const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'AED', 'TRY'];

    useEffect(() => {
        // Load balances from localStorage
        const saved = localStorage.getItem('cashBalances');
        if (saved) {
            setBalances(JSON.parse(saved));
        } else {
            // Initialize with default values
            const defaultBalances: CashBalance = {};
            CURRENCIES.forEach(curr => {
                defaultBalances[curr] = 0;
            });
            setBalances(defaultBalances);
        }
    }, []);

    const startEditing = () => {
        setEditBalances({ ...balances });
        setIsEditing(true);
    };

    const saveBalances = () => {
        setBalances(editBalances);
        localStorage.setItem('cashBalances', JSON.stringify(editBalances));
        setIsEditing(false);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditBalances({});
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        {t('transaction.helpers.cashOnHand')}
                    </CardTitle>
                    {!isEditing ? (
                        <Button variant="ghost" size="sm" onClick={startEditing}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={saveBalances}>
                                <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEditing}>
                                <X className="h-4 w-4 text-red-600" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-3">
                    {CURRENCIES.map(currency => (
                        <div key={currency}>
                            {isEditing ? (
                                <div className="space-y-1">
                                    <Label className="text-xs">{currency}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={editBalances[currency] || 0}
                                        onChange={(e) => setEditBalances({
                                            ...editBalances,
                                            [currency]: parseFloat(e.target.value) || 0
                                        })}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            ) : (
                                <Badge
                                    variant={balances[currency] > 0 ? "default" : "secondary"}
                                    className="w-full justify-between px-2 py-1"
                                >
                                    <span className="text-xs font-medium">{currency}</span>
                                    <span className="text-xs font-bold">
                                        {formatCurrency(balances[currency] || 0)}
                                    </span>
                                </Badge>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
