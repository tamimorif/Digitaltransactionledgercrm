'use client';

import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetLicenseStatus } from '@/src/queries/license.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Loader2, Building2, Mail, Calendar, Crown, Users, AlertTriangle } from 'lucide-react';
import { LicenseActivationCard } from '@/src/components/dashboard/LicenseActivationCard';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const { user, tenant, logout } = useAuth();
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
    const statuses: Record<string, { label: string; variant: any }> = {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, {user?.email}
          </p>
        </div>
        <Button onClick={logout} variant="outline">
          Logout
        </Button>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Email:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge variant="outline">{getRoleLabel(user?.role || '')}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status:</span>
              {getStatusBadge(user?.status || '')}
            </div>
            {user?.trialEndsAt && (
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
                {tenant?.userLimit === 0 ? 'Unlimited' : tenant?.userLimit}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License Status Card */}
      {isLicenseLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      ) : licenseStatus && licenseStatus.hasActiveLicense ? (
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
                {licenseStatus.currentLicense?.licenseKey}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Type:</span>
              <Badge>{licenseStatus.currentLicense?.licenseType}</Badge>
            </div>
            {licenseStatus.currentLicense?.expiresAt && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Expires:</span>
                <span className="text-sm">
                  {formatDistanceToNow(
                    new Date(licenseStatus.currentLicense.expiresAt),
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
    </div>
  );
}
