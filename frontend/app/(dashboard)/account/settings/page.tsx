'use client';

import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetLicenseStatus } from '@/src/queries/license.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Loader2, Building2, Crown, AlertTriangle, User } from 'lucide-react';
import { LicenseActivationCard } from '@/src/components/dashboard/LicenseActivationCard';
import { MyLicensesCard } from '@/src/components/dashboard/MyLicensesCard';
import { formatDistanceToNow } from 'date-fns';

export default function SettingsPage() {
    const { user, tenant } = useAuth();
    const { data: licenseStatus, isLoading: isLicenseLoading } = useGetLicenseStatus();

    const isTrialExpired = user?.status === 'trial_expired';
    const isLicenseExpired = user?.status === 'license_expired';
    const needsActivation = isTrialExpired || isLicenseExpired;

    const getRoleLabel = (role: string) => {
        const roles: Record<string, string> = {
            superadmin: 'Super Admin',
            tenant_owner: 'Owner',
            tenant_admin: 'Admin',
            tenant_user: 'User',
        };
        return roles[role] || role;
    };

    const getStatusBadge = (status: string) => {
        const statuses: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
            active: { label: 'Active', variant: 'default' },
            trial: { label: 'Trial', variant: 'secondary' },
            trial_expired: { label: 'Trial Expired', variant: 'destructive' },
            license_expired: { label: 'License Expired', variant: 'destructive' },
            suspended: { label: 'Suspended', variant: 'outline' },
        };
        const statusInfo = statuses[status] || { label: status, variant: 'outline' };
        return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Account Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Manage your account, business information, and license
                </p>
            </div>

            {/* Warning for expired trial/license */}
            {needsActivation && (
                <Card className="border-destructive">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            <CardTitle className="text-destructive">
                                {isTrialExpired ? 'Trial Period Expired' : 'License Expired'}
                            </CardTitle>
                        </div>
                        <CardDescription>
                            You need to activate a license to use the system
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Business Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Business Overview
                    </CardTitle>
                    <CardDescription>Account and company information</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* User Info Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    User Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Email:</span>
                                    <span className="font-medium">{user?.email}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Username:</span>
                                    <span className="font-medium">{user?.username || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Role:</span>
                                    <Badge variant="outline">{getRoleLabel(user?.role || '')}</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Status:</span>
                                    {getStatusBadge(user?.status || '')}
                                </div>
                                {user?.trialEndsAt && user?.status !== 'active' && !licenseStatus?.hasLicense && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Trial Ends:</span>
                                        <span className="text-sm">
                                            {formatDistanceToNow(new Date(user.trialEndsAt), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tenant Info Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Company Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Name:</span>
                                    <span className="font-medium">{tenant?.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Status:</span>
                                    {getStatusBadge(tenant?.status || '')}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">User Limit:</span>
                                    <span className="font-medium">
                                        {tenant?.userLimit === 0 || (tenant?.userLimit && tenant.userLimit >= 999999) ? 'Unlimited' : tenant?.userLimit}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            {/* License Management Section */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold">License Management</h2>

                {/* License Status Card */}
                {isLicenseLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </CardContent>
                    </Card>
                ) : licenseStatus && licenseStatus.hasLicense ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Crown className="h-5 w-5 text-yellow-500" />
                                Active License
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">License Key:</span>
                                <span className="font-mono font-medium">
                                    {licenseStatus.license?.licenseKey}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Type:</span>
                                <Badge>{licenseStatus.license?.licenseType}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">User Limit:</span>
                                <span className="font-medium">
                                    {licenseStatus.userLimit === 0 || (licenseStatus.userLimit && licenseStatus.userLimit >= 999999) ? 'Unlimited' : licenseStatus.userLimit}
                                </span>
                            </div>
                            {licenseStatus.license?.expiresAt && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Expires:</span>
                                    <span className="text-sm">
                                        {formatDistanceToNow(
                                            new Date(licenseStatus.license.expiresAt),
                                            {
                                                addSuffix: true,
                                            }
                                        )}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <LicenseActivationCard />
                )}

                {/* All Licenses - Show if user has multiple licenses */}
                <MyLicensesCard />
            </div>
        </div>
    );
}
