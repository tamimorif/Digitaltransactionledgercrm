import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { TrendingUp, Save } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface DailyRates {
  date: string;
  EUR: number;
  USD: number;
  GBP: number;
  CAD: number;
  updatedAt?: string;
}

export function DailyRatesWidget() {
  const [rates, setRates] = useState<DailyRates>({
    date: new Date().toISOString().split('T')[0],
    EUR: 0,
    USD: 0,
    GBP: 0,
    CAD: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDailyRates();
  }, []);

  const fetchDailyRates = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a3e538f5/daily-rates`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch daily rates');
      }
      
      const data = await response.json();
      if (data.success && data.rates) {
        setRates(data.rates);
      }
    } catch (error) {
      console.error('Error fetching daily rates:', error);
      toast.error('Failed to load daily rates');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a3e538f5/daily-rates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(rates),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to save daily rates');
      }
      
      const data = await response.json();
      if (data.success) {
        setRates(data.rates);
        setIsEditing(false);
        toast.success('Daily rates updated successfully');
      }
    } catch (error) {
      console.error('Error saving daily rates:', error);
      toast.error('Failed to save daily rates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (currency: 'EUR' | 'USD' | 'GBP' | 'CAD', value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => ({ ...prev, [currency]: numValue }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Daily Reference Rates (IRR)
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
                step="0.01"
              />
            ) : (
              <div className="mt-1">
                {rates.EUR > 0 ? rates.EUR.toLocaleString() : 'Not set'}
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
                step="0.01"
              />
            ) : (
              <div className="mt-1">
                {rates.USD > 0 ? rates.USD.toLocaleString() : 'Not set'}
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
                step="0.01"
              />
            ) : (
              <div className="mt-1">
                {rates.GBP > 0 ? rates.GBP.toLocaleString() : 'Not set'}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-500">CAD</label>
            {isEditing ? (
              <Input
                type="number"
                value={rates.CAD}
                onChange={(e) => handleInputChange('CAD', e.target.value)}
                className="mt-1"
                step="0.01"
              />
            ) : (
              <div className="mt-1">
                {rates.CAD > 0 ? rates.CAD.toLocaleString() : 'Not set'}
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
