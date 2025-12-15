'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetTenantById } from '@/src/lib/queries/admin.query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Loader2, ArrowLeft, Building2, Users, DollarSign, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import axiosInstance from '@/src/lib/axios-config';
import { useQuery } from '@tanstack/react-query';

interface CashBalance {
    id: number;
    currency: string;
    finalBalance: number;
    autoBalance: number;
    manualAdjustment: number;
}

interface CustomerCount {
    count: number;
}

export default function TenantDetailPage() {
    const router = useRouter();
    const params = useParams();
    const tenantId = parseInt(params.id as string);

    const { user, isLoading: authLoading } = useAuth();
    const { data: tenant, isLoading: tenantLoading } = useGetTenantById(tenantId, !authLoading && user?.role === 'superadmin');

    // Get cash balances for this tenant
    const { data: cashBalances, isLoading: balancesLoading } = useQuery<CashBalance[]>({
        queryKey: ['admin', 'tenant', tenantId, 'cash-balances'],
        queryFn: async () => {
            const response = await axiosInstance.get(`/admin/tenants/${tenantId}/cash-balances`);
            return response.data;
        },
        enabled: !authLoading && user?.role === 'superadmin' && !!tenantId,
    });

    // Get customer count for this tenant  
    const { data: customerCount, isLoading: customersLoading } = useQuery<CustomerCount>({
        queryKey: ['admin', 'tenant', tenantId, 'customer-count'],
        queryFn: async () => {
            const response = await axiosInstance.get(`/admin/tenants/${tenantId}/customer-count`);
            return response.data;
        },
        enabled: !authLoading && user?.role === 'superadmin' && !!tenantId,
    });

    useEffect(() => {
        if (!authLoading && user?.role !== 'superadmin') {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    if (authLoading || tenantLoading || user?.role !== 'superadmin') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="container mx-auto px-6 py-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Tenant Not Found</h1>
                    <Link href="/admin">
                        <Button>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Admin
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'trial':
                return 'bg-blue-100 text-blue-800';
            case 'suspended':
                return 'bg-red-100 text-red-800';
            case 'expired':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="container mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link href="/admin">
                    <Button variant="ghost" size="sm" className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Admin
                    </Button>
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{tenant.name}</h1>
                        <p className="text-muted-foreground">{tenant.ownerEmail || 'No owner email'}</p>
                    </div>
                    <Badge className={getStatusColor(tenant.status)}>{tenant.status}</Badge>
                </div>
            </div>

            {/* Basic Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">User Limit</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenant.userLimit}</div>
                        {tenant.users && (
                            <p className="text-xs text-muted-foreground">
                                {tenant.users.length} users active
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {customersLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-2xl font-bold">{customerCount?.count || 0}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Created</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {tenant.createdAt ? format(new Date(tenant.createdAt), 'MMM yyyy') : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {tenant.createdAt ? format(new Date(tenant.createdAt), 'PPP') : ''}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Cash Balances */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <DollarSign className="mr-2 h-5 w-5" />
                        Cash Balances by Currency
                    </CardTitle>
                    <CardDescription>Current cash holdings across all currencies</CardDescription>
                </CardHeader>
                <CardContent>
                    {balancesLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : !cashBalances || cashBalances.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No cash balances found
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cashBalances.map((balance) => (
                                <Card key={balance.id} className="border-2">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg">{balance.currency}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Final Balance:</span>
                                            <span className="text-lg font-bold">
                                                {balance.finalBalance.toLocaleString('en-US', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Auto Balance:</span>
                                            <span>{balance.autoBalance.toFixed(2)}</span>
                                        </div>
                                        {balance.manualAdjustment !== 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Manual Adjustment:</span>
                                                <span className={balance.manualAdjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {balance.manualAdjustment > 0 ? '+' : ''}
                                                    {balance.manualAdjustment.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* License Info */}
            {tenant.currentLicense && (
                <Card>
                    <CardHeader>
                        <CardTitle>License Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">License Type</p>
                                <p className="font-medium">{tenant.currentLicense.licenseType}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <Badge variant={tenant.currentLicense.status === 'active' ? 'default' : 'secondary'}>
                                    {tenant.currentLicense.status}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">User Limit</p>
                                <p className="font-medium">{tenant.currentLicense.userLimit}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Duration</p>
                                <p className="font-medium">{tenant.currentLicense.durationType}</p>
                            </div>
                            {tenant.currentLicense.activatedAt && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Activated</p>
                                    <p className="font-medium">
                                        {format(new Date(tenant.currentLicense.activatedAt), 'PPP')}
                                    </p>
                                </div>
                            )}
                            {tenant.currentLicense.expiresAt && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Expires</p>
                                    <p className="font-medium">
                                        {format(new Date(tenant.currentLicense.expiresAt), 'PPP')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
