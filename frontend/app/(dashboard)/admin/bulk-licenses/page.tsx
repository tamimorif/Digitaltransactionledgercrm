'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useGenerateLicense } from '@/src/queries/license.query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/src/components/ui/dialog';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Loader2, Key, Copy, Check, Download, Package } from 'lucide-react';
import { toast } from 'sonner';

interface GeneratedLicense {
    licenseKey: string;
    licenseType: string;
    userLimit: number;
}

export default function BulkLicenseGenerator() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const generateLicense = useGenerateLicense();
    const [activeTab, setActiveTab] = useState('single');

    // Single license state
    const [singleFormData, setSingleFormData] = useState({
        licenseType: 'starter' as any,
        durationType: 'yearly' as any,
        userLimit: '5',
        durationValue: '',
        notes: '',
    });
    const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Bulk generation state
    const [bulkConfig, setBulkConfig] = useState({
        licenseType: 'starter' as any,
        durationType: 'yearly' as any,
        userLimit: '5',
        quantity: '10',
        notes: '',
    });
    const [bulkGenerating, setBulkGenerating] = useState(false);
    const [generatedLicenses, setGeneratedLicenses] = useState<GeneratedLicense[]>([]);
    const [showBulkResults, setShowBulkResults] = useState(false);

    // Check authentication and role
    useEffect(() => {
        if (!authLoading && user?.role !== 'superadmin') {
            toast.error('Access Denied', {
                description: 'Only SuperAdmin can access this page',
            });
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    // Show loading state while checking auth
    if (authLoading || user?.role !== 'superadmin') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Single License Generation
    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await generateLicense.mutateAsync({
                licenseType: singleFormData.licenseType,
                durationType: singleFormData.durationType,
                userLimit: parseInt(singleFormData.userLimit),
                durationValue: singleFormData.durationValue ? parseInt(singleFormData.durationValue) : undefined,
                notes: singleFormData.notes || undefined,
            });

            setGeneratedLicense(response.licenseKey);
            toast.success('License generated successfully');
        } catch (error: any) {
            toast.error('Failed to generate license', {
                description: error?.response?.data?.error || 'Please try again',
            });
        }
    };

    // Bulk License Generation
    const handleBulkGenerate = async () => {
        setBulkGenerating(true);
        const licenses: GeneratedLicense[] = [];
        const quantity = parseInt(bulkConfig.quantity);

        try {
            for (let i = 0; i < quantity; i++) {
                const response = await generateLicense.mutateAsync({
                    licenseType: bulkConfig.licenseType,
                    durationType: bulkConfig.durationType,
                    userLimit: parseInt(bulkConfig.userLimit),
                    notes: bulkConfig.notes || `Bulk generated batch ${Date.now()}`,
                });

                licenses.push({
                    licenseKey: response.licenseKey,
                    licenseType: response.licenseType,
                    userLimit: response.userLimit,
                });

                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            setGeneratedLicenses(licenses);
            setShowBulkResults(true);
            toast.success(`Successfully generated ${quantity} licenses`);
        } catch (error: any) {
            toast.error('Bulk generation failed', {
                description: error?.response?.data?.error || 'Please try again',
            });
        } finally {
            setBulkGenerating(false);
        }
    };

    // Copy functions
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const copyAllLicenses = () => {
        const allKeys = generatedLicenses.map(l => l.licenseKey).join('\n');
        navigator.clipboard.writeText(allKeys);
        toast.success('All licenses copied to clipboard');
    };

    // Export to CSV
    const exportToCSV = () => {
        const csv = [
            ['License Key', 'Type', 'User Limit', 'Generated At'],
            ...generatedLicenses.map(l => [
                l.licenseKey,
                l.licenseType,
                l.userLimit.toString(),
                new Date().toISOString(),
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `licenses-${Date.now()}.csv`;
        a.click();
        toast.success('Licenses exported to CSV');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">License Generator</h1>
                <p className="text-muted-foreground">
                    Generate single or multiple licenses for your customers
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="single">
                        <Key className="h-4 w-4 mr-2" />
                        Single License
                    </TabsTrigger>
                    <TabsTrigger value="bulk">
                        <Package className="h-4 w-4 mr-2" />
                        Bulk Generation
                    </TabsTrigger>
                </TabsList>

                {/* Single License Tab */}
                <TabsContent value="single">
                    <Card>
                        <CardHeader>
                            <CardTitle>Generate Single License</CardTitle>
                            <CardDescription>
                                Create one license key for immediate use
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSingleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>License Type</Label>
                                        <Select
                                            value={singleFormData.licenseType}
                                            onValueChange={(value) =>
                                                setSingleFormData({ ...singleFormData, licenseType: value as any })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="trial">Trial - 3 users</SelectItem>
                                                <SelectItem value="starter">Starter - 5 users</SelectItem>
                                                <SelectItem value="professional">Professional - 20 users</SelectItem>
                                                <SelectItem value="business">Business - 50 users</SelectItem>
                                                <SelectItem value="enterprise">Enterprise - Unlimited</SelectItem>
                                                <SelectItem value="custom">Custom</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Duration</Label>
                                        <Select
                                            value={singleFormData.durationType}
                                            onValueChange={(value) =>
                                                setSingleFormData({ ...singleFormData, durationType: value as any })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="lifetime">Lifetime</SelectItem>
                                                <SelectItem value="yearly">Yearly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="custom_days">Custom Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {singleFormData.licenseType === 'custom' && (
                                    <div className="space-y-2">
                                        <Label>User Limit</Label>
                                        <Input
                                            type="number"
                                            value={singleFormData.userLimit}
                                            onChange={(e) =>
                                                setSingleFormData({ ...singleFormData, userLimit: e.target.value })
                                            }
                                            placeholder="5"
                                        />
                                    </div>
                                )}

                                {singleFormData.durationType === 'custom_days' && (
                                    <div className="space-y-2">
                                        <Label>Duration (Days)</Label>
                                        <Input
                                            type="number"
                                            value={singleFormData.durationValue}
                                            onChange={(e) =>
                                                setSingleFormData({ ...singleFormData, durationValue: e.target.value })
                                            }
                                            placeholder="30"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Notes (Optional)</Label>
                                    <Textarea
                                        value={singleFormData.notes}
                                        onChange={(e) =>
                                            setSingleFormData({ ...singleFormData, notes: e.target.value })
                                        }
                                        placeholder="Customer name, order ID, etc..."
                                        rows={3}
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={generateLicense.isPending}>
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
                                            onClick={() => copyToClipboard(generatedLicense)}
                                        >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Bulk Generation Tab */}
                <TabsContent value="bulk">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bulk License Generation</CardTitle>
                            <CardDescription>
                                Generate multiple licenses at once for reselling or distribution
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>License Type</Label>
                                    <Select
                                        value={bulkConfig.licenseType}
                                        onValueChange={(value) =>
                                            setBulkConfig({ ...bulkConfig, licenseType: value as any })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="trial">Trial - 3 users</SelectItem>
                                            <SelectItem value="starter">Starter - 5 users</SelectItem>
                                            <SelectItem value="professional">Professional - 20 users</SelectItem>
                                            <SelectItem value="business">Business - 50 users</SelectItem>
                                            <SelectItem value="enterprise">Enterprise - Unlimited</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={bulkConfig.quantity}
                                        onChange={(e) =>
                                            setBulkConfig({ ...bulkConfig, quantity: e.target.value })
                                        }
                                        placeholder="10"
                                    />
                                    <p className="text-xs text-muted-foreground">Max: 100 licenses per batch</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes (Optional)</Label>
                                <Textarea
                                    value={bulkConfig.notes}
                                    onChange={(e) =>
                                        setBulkConfig({ ...bulkConfig, notes: e.target.value })
                                    }
                                    placeholder="Batch identifier, campaign name, etc..."
                                    rows={2}
                                />
                            </div>

                            <Button
                                onClick={handleBulkGenerate}
                                className="w-full"
                                disabled={bulkGenerating}
                                size="lg"
                            >
                                {bulkGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Generating {bulkConfig.quantity} Licenses...
                                    </>
                                ) : (
                                    <>
                                        <Package className="mr-2 h-5 w-5" />
                                        Generate {bulkConfig.quantity} Licenses
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Bulk Results Dialog */}
            <Dialog open={showBulkResults} onOpenChange={setShowBulkResults}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>Generated Licenses</DialogTitle>
                        <DialogDescription>
                            {generatedLicenses.length} licenses have been successfully generated
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button onClick={copyAllLicenses} variant="outline" size="sm">
                                <Copy className="h-4 w-4 mr-2" />
                                Copy All
                            </Button>
                            <Button onClick={exportToCSV} variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Export CSV
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {generatedLicenses.map((license, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                                >
                                    <div className="flex-1 space-y-1">
                                        <code className="text-sm font-mono">{license.licenseKey}</code>
                                        <div className="flex gap-2">
                                            <Badge variant="secondary" className="text-xs">
                                                {license.licenseType}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {license.userLimit} users
                                            </Badge>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard(license.licenseKey)}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowBulkResults(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
