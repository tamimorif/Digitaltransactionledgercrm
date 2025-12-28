'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useGenerateLicense } from '@/src/lib/queries/license.query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Loader2, Key, Copy, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getErrorMessage } from '@/src/lib/error';

type LicenseType = 'trial' | 'starter' | 'professional' | 'business' | 'enterprise' | 'custom';
type DurationType = 'lifetime' | 'monthly' | 'yearly' | 'custom_days';

export default function GenerateLicensePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const generateLicense = useGenerateLicense();
  const [copied, setCopied] = useState(false);
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    licenseType: LicenseType;
    durationType: DurationType;
    userLimit: string;
    durationValue: string;
    notes: string;
  }>({
    licenseType: 'starter',
    durationType: 'yearly',
    userLimit: '5',
    durationValue: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && user?.role !== 'superadmin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || user?.role !== 'superadmin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await generateLicense.mutateAsync({
        licenseType: formData.licenseType,
        durationType: formData.durationType,
        userLimit: parseInt(formData.userLimit),
        durationValue: formData.durationValue ? parseInt(formData.durationValue) : undefined,
        notes: formData.notes || undefined,
      });

      setGeneratedLicense(response.licenseKey);
      toast.success('License generated successfully');
    } catch (error) {
      toast.error('Failed to generate license', {
        description: getErrorMessage(error, 'Please try again'),
      });
    }
  };

  const copyToClipboard = () => {
    if (generatedLicense) {
      navigator.clipboard.writeText(generatedLicense);
      setCopied(true);
      toast.success('License key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Generate License</h1>
        <p className="text-muted-foreground">
          Create a new license key for tenant activation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            License Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="licenseType">License Type</Label>
              <Select
                value={formData.licenseType}
                onValueChange={(value) =>
                  setFormData({ ...formData, licenseType: value as LicenseType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (14 days, 3 users)</SelectItem>
                  <SelectItem value="starter">Starter (5 users)</SelectItem>
                  <SelectItem value="professional">Professional (20 users)</SelectItem>
                  <SelectItem value="business">Business (50 users)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (Unlimited)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationType">Duration Type</Label>
              <Select
                value={formData.durationType}
                onValueChange={(value) =>
                  setFormData({ ...formData, durationType: value as DurationType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom_days">Custom Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.durationType === 'custom_days' && (
              <div className="space-y-2">
                <Label htmlFor="durationValue">Duration (Days)</Label>
                <Input
                  id="durationValue"
                  type="number"
                  value={formData.durationValue}
                  onChange={(e) =>
                    setFormData({ ...formData, durationValue: e.target.value })
                  }
                  placeholder="30"
                  required
                />
              </div>
            )}

            {formData.licenseType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="userLimit">User Limit</Label>
                <Input
                  id="userLimit"
                  type="number"
                  value={formData.userLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, userLimit: e.target.value })
                  }
                  placeholder="5"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Add any notes about this license..."
                rows={3}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={generateLicense.isPending}
            >
              {generateLicense.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Generate License
                </>
              )}
            </Button>
          </form>

          {generatedLicense && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Label className="text-sm font-medium text-green-900 mb-2 block">
                Generated License Key
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-white border rounded font-mono text-sm break-all">
                  {generatedLicense}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-green-700 mt-2">
                Share this key with the tenant owner to activate their account
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
