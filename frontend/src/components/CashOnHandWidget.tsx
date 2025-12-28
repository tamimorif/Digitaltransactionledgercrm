'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Wallet, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CashBalances {
    CAD: number;
    USD: number;
    EUR: number;
    IRR: number;
    updatedAt?: string;
}

type RateMap = Record<string, number>;

export function CashOnHandWidget() {
    const [balances, setBalances] = useState<CashBalances>({
        CAD: 0,
        USD: 0,
        EUR: 0,
        IRR: 0,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchCashBalances();
    }, []);

    const fetchCashBalances = () => {
        try {
            const stored = localStorage.getItem('cashOnHand');
            if (stored) {
                const parsed = JSON.parse(stored);
                setBalances(parsed);
            }
        } catch (error) {
            console.error('Error fetching cash balances:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedBalances = {
                ...balances,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem('cashOnHand', JSON.stringify(updatedBalances));
            setBalances(updatedBalances);
            setIsEditing(false);
            toast.success('Cash balances updated successfully');
        } catch (error) {
            console.error('Error saving cash balances:', error);
            toast.error('Failed to save cash balances');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (currency: 'CAD' | 'USD' | 'EUR' | 'IRR', value: string) => {
        // Allow empty string or parse to number (including 0)
        const numValue = value === '' ? 0 : parseFloat(value);
        setBalances(prev => ({ ...prev, [currency]: isNaN(numValue) ? 0 : numValue }));
    };

    // Calculate total in CAD (base currency)
    // Uses buy rates from BuySellRatesWidget
    // Since rates show how much 1 USD equals in each currency:
    // To convert to CAD: multiply USD by CAD rate, divide others by their rate then multiply by CAD rate
    const calculateTotal = (): number => {
        try {
            // Try new format first (from BuySellRatesWidget)
            let stored = localStorage.getItem('buySellRates');
            let rates: RateMap;

            if (stored) {
                rates = JSON.parse(stored) as RateMap;
                // Start with CAD (base currency)
                let total = balances.CAD;

                // Convert USD to CAD: USD * CAD_BUY (e.g., 100 USD * 1.38 = 138 CAD)
                if (rates.CAD_BUY > 0) {
                    total += balances.USD * rates.CAD_BUY;
                }

                // Convert EUR to CAD: EUR / EUR_BUY * CAD_BUY
                if (rates.EUR_BUY > 0 && rates.CAD_BUY > 0) {
                    total += (balances.EUR / rates.EUR_BUY) * rates.CAD_BUY;
                }

                // Convert IRR to CAD: IRR / IRR_BUY * CAD_BUY
                if (rates.IRR_BUY > 0 && rates.CAD_BUY > 0) {
                    total += (balances.IRR / rates.IRR_BUY) * rates.CAD_BUY;
                }

                return total;
            }

            // Fallback to old format
            stored = localStorage.getItem('dailyRates');
            if (!stored) return balances.CAD;

            rates = JSON.parse(stored) as RateMap;
            let total = balances.CAD;

            if (rates.CAD > 0) total += balances.USD * rates.CAD;
            if (rates.EUR > 0 && rates.CAD > 0) total += (balances.EUR / rates.EUR) * rates.CAD;
            if (rates.IRR > 0 && rates.CAD > 0) total += (balances.IRR / rates.IRR) * rates.CAD;

            return total;
        } catch {
            return balances.CAD;
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Cash on Hand
                </CardTitle>
                {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        Edit
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setIsEditing(false);
                                fetchCashBalances();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-4 gap-4">
                    <div>
                        <label className="text-sm text-gray-500">CAD</label>
                        {isEditing ? (
                            <Input
                                type="number"
                                value={balances.CAD === 0 ? '' : balances.CAD}
                                onChange={(e) => handleInputChange('CAD', e.target.value)}
                                className="mt-1"
                                step="0.01"
                                placeholder="0.00"
                            />
                        ) : (
                            <div className="mt-1 text-lg font-semibold">
                                {balances.CAD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">USD</label>
                        {isEditing ? (
                            <Input
                                type="number"
                                value={balances.USD === 0 ? '' : balances.USD}
                                onChange={(e) => handleInputChange('USD', e.target.value)}
                                className="mt-1"
                                step="0.01"
                                placeholder="0.00"
                            />
                        ) : (
                            <div className="mt-1 text-lg font-semibold">
                                {balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">EUR</label>
                        {isEditing ? (
                            <Input
                                type="number"
                                value={balances.EUR === 0 ? '' : balances.EUR}
                                onChange={(e) => handleInputChange('EUR', e.target.value)}
                                className="mt-1"
                                step="0.01"
                                placeholder="0.00"
                            />
                        ) : (
                            <div className="mt-1 text-lg font-semibold">
                                {balances.EUR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">IRR</label>
                        {isEditing ? (
                            <Input
                                type="number"
                                value={balances.IRR === 0 ? '' : balances.IRR}
                                onChange={(e) => handleInputChange('IRR', e.target.value)}
                                className="mt-1"
                                step="0.01"
                                placeholder="0.00"
                            />
                        ) : (
                            <div className="mt-1 text-lg font-semibold">
                                {balances.IRR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total (in CAD):</span>
                        <span className="text-xl font-bold">{calculateTotal().toFixed(2)} CAD</span>
                    </div>
                </div>
                {balances.updatedAt && !isEditing && (
                    <p className="text-xs text-gray-400 mt-3">
                        Last updated: {new Date(balances.updatedAt).toLocaleString()}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
