'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Edit, Check, X } from 'lucide-react';
import { formatCurrency } from '@/src/lib/format';
import { cn } from '@/src/lib/utils';

interface CashBalance {
    [currency: string]: number;
}

const CURRENCIES = [
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'AED', name: 'UAE Dirham' },
    { code: 'USDT', name: 'Tether' },
    { code: 'TRY', name: 'Turkish Lira' },
    { code: 'IRR', name: 'Iranian Rial' },
    { code: 'AFN', name: 'Afghan Afghani' },
];

interface CashBalanceWidgetProps {
    className?: string;
}

export function CashBalanceWidget({ className }: CashBalanceWidgetProps) {
    const [balances, setBalances] = useState<CashBalance>({});
    const [isEditing, setIsEditing] = useState(false);
    const [editBalances, setEditBalances] = useState<CashBalance>({});

    useEffect(() => {
        const saved = localStorage.getItem('cashBalances');
        if (saved) {
            setBalances(JSON.parse(saved));
        } else {
            const defaultBalances: CashBalance = {};
            CURRENCIES.forEach((currency) => {
                defaultBalances[currency.code] = 0;
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
        <div className={cn('relative group', className)}>
            {!isEditing && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={startEditing}
                >
                    <Edit className="h-3 w-3 text-muted-foreground" />
                </Button>
            )}
            
            {isEditing && (
                <div className="absolute -top-8 right-0 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={saveBalances} className="h-6 px-2">
                        <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEditing} className="h-6 px-2">
                        <X className="h-3 w-3 text-red-600" />
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                {CURRENCIES.map((currency) => (
                    <div
                        key={currency.code}
                        className="flex items-center justify-between"
                    >
                        {isEditing ? (
                            <div className="flex items-center gap-2 w-full">
                                <Label className="text-xs font-medium text-gray-400 w-8">
                                    {currency.code}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editBalances[currency.code] || 0}
                                    onChange={(e) => setEditBalances({
                                        ...editBalances,
                                        [currency.code]: parseFloat(e.target.value) || 0
                                    })}
                                    className="h-6 text-xs flex-1 py-0 px-1"
                                />
                            </div>
                        ) : (
                            <>
                                <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">
                                    {currency.code}
                                </span>
                                <span className="text-sm font-semibold font-mono tracking-tight text-gray-900">
                                    {formatCurrency(balances[currency.code] || 0)}
                                </span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
