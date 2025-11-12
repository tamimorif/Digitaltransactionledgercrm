'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { TrendingUp, TrendingDown, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ExchangeRates {
    date: string;
    CAD_BUY: number;
    CAD_SELL: number;
    EUR_BUY: number;
    EUR_SELL: number;
    GBP_BUY: number;
    GBP_SELL: number;
    IRR_BUY: number;
    IRR_SELL: number;
    updatedAt?: string;
}

export function BuySellRatesWidget() {
    const [rates, setRates] = useState<ExchangeRates>({
        date: new Date().toISOString().split('T')[0],
        CAD_BUY: 0,
        CAD_SELL: 0,
        EUR_BUY: 0,
        EUR_SELL: 0,
        GBP_BUY: 0,
        GBP_SELL: 0,
        IRR_BUY: 0,
        IRR_SELL: 0,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const stored = localStorage.getItem('buySellRates');
            if (stored) {
                const parsed = JSON.parse(stored);
                setRates(parsed);
            }
        } catch (error) {
            console.error('Error fetching rates:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedRates = {
                ...rates,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem('buySellRates', JSON.stringify(updatedRates));

            // Also save to dailyRates for backward compatibility with CashOnHandWidget
            const dailyRates = {
                date: rates.date,
                CAD: rates.CAD_BUY,
                EUR: rates.EUR_BUY,
                GBP: rates.GBP_BUY,
                IRR: rates.IRR_BUY,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem('dailyRates', JSON.stringify(dailyRates));

            setRates(updatedRates);
            setIsEditing(false);
            toast.success('Exchange rates updated successfully');
        } catch (error) {
            console.error('Error saving rates:', error);
            toast.error('Failed to save rates');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field: keyof ExchangeRates, value: string) => {
        // Allow empty string or parse to number (including 0)
        const numValue = value === '' ? 0 : parseFloat(value);
        setRates(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buy Rates Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Buy Rates (1 USD =)
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
                                    fetchRates();
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
                                    value={rates.CAD_BUY === 0 ? '' : rates.CAD_BUY}
                                    onChange={(e) => handleInputChange('CAD_BUY', e.target.value)}
                                    className="mt-1"
                                    step="0.0001"
                                    placeholder="1.3820"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.CAD_BUY > 0 ? rates.CAD_BUY.toFixed(4) : 'Not set'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">EUR</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.EUR_BUY === 0 ? '' : rates.EUR_BUY}
                                    onChange={(e) => handleInputChange('EUR_BUY', e.target.value)}
                                    className="mt-1"
                                    step="0.0001"
                                    placeholder="0.9350"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.EUR_BUY > 0 ? rates.EUR_BUY.toFixed(4) : 'Not set'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">GBP</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.GBP_BUY === 0 ? '' : rates.GBP_BUY}
                                    onChange={(e) => handleInputChange('GBP_BUY', e.target.value)}
                                    className="mt-1"
                                    step="0.0001"
                                    placeholder="0.8045"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.GBP_BUY > 0 ? rates.GBP_BUY.toFixed(4) : 'Not set'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">IRR</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.IRR_BUY === 0 ? '' : rates.IRR_BUY}
                                    onChange={(e) => handleInputChange('IRR_BUY', e.target.value)}
                                    className="mt-1"
                                    step="1"
                                    placeholder="52000"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.IRR_BUY > 0 ? rates.IRR_BUY.toLocaleString() : 'Not set'}
                                </div>
                            )}
                        </div>
                    </div>
                    {rates.updatedAt && !isEditing && (
                        <p className="text-xs text-gray-400 mt-4">
                            Last updated: {new Date(rates.updatedAt).toLocaleString()}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Sell Rates Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        Sell Rates (1 USD =)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-gray-500">CAD</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.CAD_SELL === 0 ? '' : rates.CAD_SELL}
                                    onChange={(e) => handleInputChange('CAD_SELL', e.target.value)}
                                    className="mt-1"
                                    step="0.0001"
                                    placeholder="1.3600"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.CAD_SELL > 0 ? rates.CAD_SELL.toFixed(4) : 'Not set'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">EUR</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.EUR_SELL === 0 ? '' : rates.EUR_SELL}
                                    onChange={(e) => handleInputChange('EUR_SELL', e.target.value)}
                                    className="mt-1"
                                    step="0.0001"
                                    placeholder="0.9150"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.EUR_SELL > 0 ? rates.EUR_SELL.toFixed(4) : 'Not set'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">GBP</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.GBP_SELL === 0 ? '' : rates.GBP_SELL}
                                    onChange={(e) => handleInputChange('GBP_SELL', e.target.value)}
                                    className="mt-1"
                                    step="0.0001"
                                    placeholder="0.7850"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.GBP_SELL > 0 ? rates.GBP_SELL.toFixed(4) : 'Not set'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">IRR</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={rates.IRR_SELL === 0 ? '' : rates.IRR_SELL}
                                    onChange={(e) => handleInputChange('IRR_SELL', e.target.value)}
                                    className="mt-1"
                                    step="1"
                                    placeholder="51000"
                                />
                            ) : (
                                <div className="mt-1">
                                    {rates.IRR_SELL > 0 ? rates.IRR_SELL.toLocaleString() : 'Not set'}
                                </div>
                            )}
                        </div>
                    </div>
                    {rates.updatedAt && !isEditing && (
                        <p className="text-xs text-gray-400 mt-4">
                            Last updated: {new Date(rates.updatedAt).toLocaleString()}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
