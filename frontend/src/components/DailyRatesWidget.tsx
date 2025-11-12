'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { TrendingUp, Save } from 'lucide-react';
import { toast } from 'sonner';

interface DailyRates {
  date: string;
  EUR: number;
  USD: number;
  GBP: number;
  IRR: number;
  updatedAt?: string;
}

export function DailyRatesWidget() {
  const [rates, setRates] = useState<DailyRates>({
    date: new Date().toISOString().split('T')[0],
    EUR: 0,
    USD: 0,
    GBP: 0,
    IRR: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDailyRates();
  }, []);

  const fetchDailyRates = async () => {
    try {
      // Load from localStorage (temporary solution until backend endpoint is added)
      const stored = localStorage.getItem('dailyRates');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRates(parsed);
      }
    } catch (error) {
      console.error('Error fetching daily rates:', error);
      // Don't show error toast on initial load if no rates exist
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (temporary solution until backend endpoint is added)
      const updatedRates = {
        ...rates,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('dailyRates', JSON.stringify(updatedRates));
      setRates(updatedRates);
      setIsEditing(false);
      toast.success('Daily rates updated successfully');
    } catch (error) {
      console.error('Error saving daily rates:', error);
      toast.error('Failed to save daily rates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (currency: 'EUR' | 'USD' | 'GBP' | 'IRR', value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => ({ ...prev, [currency]: numValue }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Daily Reference Rates (1 CAD =)
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
                fetchDailyRates();
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
            <label className="text-sm text-gray-500">EUR</label>
            {isEditing ? (
              <Input
                type="number"
                value={rates.EUR}
                onChange={(e) => handleInputChange('EUR', e.target.value)}
                className="mt-1"
                step="0.0001"
                placeholder="e.g., 0.6789"
              />
            ) : (
              <div className="mt-1">
                {rates.EUR > 0 ? rates.EUR.toFixed(4) : 'Not set'}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-500">USD</label>
            {isEditing ? (
              <Input
                type="number"
                value={rates.USD}
                onChange={(e) => handleInputChange('USD', e.target.value)}
                className="mt-1"
                step="0.0001"
                placeholder="e.g., 0.7234"
              />
            ) : (
              <div className="mt-1">
                {rates.USD > 0 ? rates.USD.toFixed(4) : 'Not set'}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-500">GBP</label>
            {isEditing ? (
              <Input
                type="number"
                value={rates.GBP}
                onChange={(e) => handleInputChange('GBP', e.target.value)}
                className="mt-1"
                step="0.0001"
                placeholder="e.g., 0.5821"
              />
            ) : (
              <div className="mt-1">
                {rates.GBP > 0 ? rates.GBP.toFixed(4) : 'Not set'}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-500">IRR</label>
            {isEditing ? (
              <Input
                type="number"
                value={rates.IRR}
                onChange={(e) => handleInputChange('IRR', e.target.value)}
                className="mt-1"
                step="1"
                placeholder="e.g., 37500"
              />
            ) : (
              <div className="mt-1">
                {rates.IRR > 0 ? rates.IRR.toLocaleString() : 'Not set'}
              </div>
            )}
          </div>
        </div>
        {rates.updatedAt && !isEditing && (
          <p className="text-xs text-gray-400 mt-3">
            Last updated: {new Date(rates.updatedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
