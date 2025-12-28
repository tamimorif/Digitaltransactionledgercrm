'use client';

import { useState } from 'react';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, User, Lock, Building2, CreditCard, Save, Eye, EyeOff } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { getErrorMessage } from '@/src/lib/error';

interface License {
    id: number;
    maxBranches: number;
    expiresAt: string;
    status: string;
}

interface TenantInfo {
    id: number;
    name: string;
    activeBranches: number;
    license?: License;
}

export default function SettingsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Profile form state
    const [profileData, setProfileData] = useState({
        username: user?.username || '',
        email: user?.email || '',
    });

    // Password form state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    // Fetch tenant info with license
    const { data: tenantInfo, isLoading: loadingTenant } = useQuery<TenantInfo>({
        queryKey: ['tenant-info'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:8080/api/tenant/info', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        },
        enabled: user?.role !== 'superadmin',
    });

    // Update username mutation
    const updateUsernameMutation = useMutation({
        mutationFn: async (username: string) => {
            const token = localStorage.getItem('token');
            const response = await axios.put(`http://localhost:8080/api/users/${user?.id}`,
                { username },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            toast.success('Username updated successfully');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to update username'));
        }
    });

    // Change password mutation
    const changePasswordMutation = useMutation({
        mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
            const token = localStorage.getItem('token');
            const response = await axios.post('http://localhost:8080/api/auth/change-password', data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success('Password changed successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to change password'));
        }
    });

    const handleUpdateProfile = async () => {
        if (!profileData.username.trim()) {
            toast.error('Username cannot be empty');
            return;
        }
        await updateUsernameMutation.mutateAsync(profileData.username);
    };

    const handleChangePassword = async () => {
        if (!passwordData.currentPassword || !passwordData.newPassword) {
            toast.error('All password fields are required');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            toast.error('New password must be at least 6 characters');
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        await changePasswordMutation.mutateAsync({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
        });
    };

    if (user?.role === 'superadmin') {
        return (
            <div className="container mx-auto px-6 py-8">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Settings not available for SuperAdmin</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-6 py-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your account and organization settings</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="profile">
                        <User className="h-4 w-4 mr-2" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger value="security">
                        <Lock className="h-4 w-4 mr-2" />
                        Security
                    </TabsTrigger>
                    <TabsTrigger value="organization">
                        <Building2 className="h-4 w-4 mr-2" />
                        Organization
                    </TabsTrigger>
                    <TabsTrigger value="license">
                        <CreditCard className="h-4 w-4 mr-2" />
                        License
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Update your personal details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    value={profileData.username}
                                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                    placeholder="Enter username"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    value={profileData.email}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Badge variant="secondary" className="text-sm">
                                    {user?.role?.replace('_', ' ').toUpperCase()}
                                </Badge>
                            </div>

                            <Button
                                onClick={handleUpdateProfile}
                                disabled={updateUsernameMutation.isPending}
                            >
                                {updateUsernameMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security">
                    <Card>
                        <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>Update your password to keep your account secure</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password *</Label>
                                <div className="relative">
                                    <Input
                                        id="currentPassword"
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        placeholder="Enter current password"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    >
                                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password *</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showNewPassword ? "text" : "password"}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="Enter new password (min 6 characters)"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                    >
                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    placeholder="Confirm new password"
                                />
                            </div>

                            <Button
                                onClick={handleChangePassword}
                                disabled={changePasswordMutation.isPending}
                            >
                                {changePasswordMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                <Lock className="mr-2 h-4 w-4" />
                                Change Password
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Organization Tab */}
                <TabsContent value="organization">
                    <Card>
                        <CardHeader>
                            <CardTitle>Organization Details</CardTitle>
                            <CardDescription>View your organization information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loadingTenant ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : tenantInfo ? (
                                <>
                                    <div className="space-y-2">
                                        <Label>Organization Name</Label>
                                        <p className="text-lg font-medium">{tenantInfo.name}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Active Branches</Label>
                                        <p className="text-2xl font-bold text-primary">
                                            {tenantInfo.activeBranches}
                                            {tenantInfo.license && (
                                                <span className="text-sm text-muted-foreground font-normal ml-2">
                                                    / {tenantInfo.license.maxBranches} available
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground">Unable to load organization information</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* License Tab */}
                <TabsContent value="license">
                    <Card>
                        <CardHeader>
                            <CardTitle>License Information</CardTitle>
                            <CardDescription>View your active license details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loadingTenant ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : tenantInfo?.license ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>License Status</Label>
                                            <Badge
                                                variant={tenantInfo.license.status === 'active' ? 'default' : 'destructive'}
                                                className="text-lg px-4 py-1"
                                            >
                                                {tenantInfo.license.status.toUpperCase()}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Expires On</Label>
                                            <p className="text-lg font-medium">
                                                {format(new Date(tenantInfo.license.expiresAt), 'MMM dd, yyyy')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Maximum Branches</Label>
                                        <p className="text-2xl font-bold">{tenantInfo.license.maxBranches}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Branch Usage</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                                <div
                                                    className="bg-primary h-full transition-all"
                                                    style={{
                                                        width: `${(tenantInfo.activeBranches / tenantInfo.license.maxBranches) * 100}%`
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium">
                                                {tenantInfo.activeBranches} / {tenantInfo.license.maxBranches}
                                            </span>
                                        </div>
                                    </div>

                                    {tenantInfo.activeBranches >= tenantInfo.license.maxBranches && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <p className="text-sm text-yellow-800">
                                                ⚠️ You have reached your maximum branch limit. Contact support to upgrade your license.
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                    <p className="text-muted-foreground">No active license found</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
