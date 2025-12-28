'use client';

import { useState } from 'react';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Separator } from '@/src/components/ui/separator';
import { toast } from 'sonner';
import { Edit2, Mail, User, Building2, Shield, Calendar, Check, X } from 'lucide-react';
import axiosInstance from '@/src/lib/axios-config';
import { getErrorMessage } from '@/src/lib/error';

export default function AccountPage() {
    const { user, tenant, refreshUser } = useAuth();
    const [isEditingName, setIsEditingName] = useState(false);
    const [newOrgName, setNewOrgName] = useState(tenant?.name || '');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdateOrgName = async () => {
        if (!newOrgName.trim()) {
            toast.error('Organization name cannot be empty');
            return;
        }

        setIsUpdating(true);
        try {
            await axiosInstance.put('/tenant/update-name', { name: newOrgName });
            toast.success('Organization name updated successfully');
            setIsEditingName(false);
            await refreshUser();
        } catch (error) {
            console.error('Failed to update organization name:', error);
            toast.error('Failed to update organization name', {
                description: getErrorMessage(error, 'Please try again'),
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'superadmin':
                return 'Super Admin';
            case 'tenant_owner':
                return 'Organization Owner';
            case 'tenant_admin':
                return 'Administrator';
            case 'tenant_user':
                return 'User';
            default:
                return role;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-500';
            case 'trial':
                return 'bg-blue-500';
            case 'trial_expired':
            case 'license_expired':
            case 'expired':
                return 'bg-red-500';
            case 'suspended':
                return 'bg-orange-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getTenantStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-500';
            case 'trial':
                return 'bg-blue-500';
            case 'expired':
                return 'bg-red-500';
            case 'suspended':
                return 'bg-orange-500';
            default:
                return 'bg-gray-500';
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">Loading account details...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Account Details</h1>
                <p className="text-muted-foreground">
                    View and manage your account information
                </p>
            </div>

            {/* Personal Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Personal Information
                    </CardTitle>
                    <CardDescription>Your personal account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email Address
                            </Label>
                            <p className="text-lg font-medium">{user.email}</p>
                            {user.emailVerified ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                    Verified
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                    Not Verified
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Role
                            </Label>
                            <p className="text-lg font-medium">{getRoleLabel(user.role)}</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground">User ID</Label>
                            <p className="text-sm font-mono text-muted-foreground">{user.id}</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Account Status</Label>
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${getStatusColor(user.status)}`} />
                                <p className="text-sm font-medium capitalize">{user.status.replace('_', ' ')}</p>
                            </div>
                        </div>

                        {user.createdAt && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Member Since
                                </Label>
                                <p className="text-sm">
                                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </p>
                            </div>
                        )}

                        {user.trialEndsAt && !user.licenseActivatedAt && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Trial Ends</Label>
                                <p className="text-sm">
                                    {new Date(user.trialEndsAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </p>
                            </div>
                        )}

                        {user.licenseActivatedAt && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-green-600" />
                                    License Activated
                                </Label>
                                <p className="text-sm">
                                    {new Date(user.licenseActivatedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </p>
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                    Active
                                </Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Organization Information */}
            {tenant && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Organization Information
                        </CardTitle>
                        <CardDescription>Details about your organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Organization Name</Label>
                                {isEditingName ? (
                                    <div className="flex gap-2">
                                        <Input
                                            value={newOrgName}
                                            onChange={(e) => setNewOrgName(e.target.value)}
                                            placeholder="Enter organization name"
                                            disabled={isUpdating}
                                        />
                                        <Button
                                            onClick={handleUpdateOrgName}
                                            disabled={isUpdating}
                                            size="icon"
                                            variant="default"
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setIsEditingName(false);
                                                setNewOrgName(tenant.name);
                                            }}
                                            disabled={isUpdating}
                                            size="icon"
                                            variant="outline"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-medium">{tenant.name}</p>
                                        {user.role === 'tenant_owner' && (
                                            <Button
                                                onClick={() => setIsEditingName(true)}
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Tenant ID</Label>
                                    <p className="text-sm font-mono text-muted-foreground">{tenant.id}</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Status</Label>
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${getTenantStatusColor(tenant.status)}`} />
                                        <p className="text-sm font-medium capitalize">{tenant.status}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">User Limit</Label>
                                    <p className="text-lg font-medium">
                                        {tenant.userLimit === 0 || tenant.userLimit >= 999999
                                            ? 'Unlimited'
                                            : tenant.userLimit}
                                    </p>
                                </div>

                                {tenant.currentLicenseId && (
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Current License ID</Label>
                                        <p className="text-sm font-mono text-muted-foreground">
                                            {tenant.currentLicenseId}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
