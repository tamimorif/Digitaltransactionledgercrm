'use client';

import { useGetAdminDashboardStats } from '@/src/lib/queries/admin.query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Building2, Key, Users, Activity } from 'lucide-react';
import { Skeleton } from '@/src/components/ui/skeleton';

export default function AdminDashboard() {
    const { data: stats, isLoading } = useGetAdminDashboardStats();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-2">Overview of system health and usage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tenants Stats */}
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600">
                            Total Tenants
                        </CardTitle>
                        <Building2 className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">
                            {stats?.totalTenants || 0}
                        </div>
                        <p className="text-xs text-blue-600/80 mt-1">
                            Registered organizations
                        </p>
                    </CardContent>
                </Card>

                {/* Licenses Stats */}
                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600">
                            Active Licenses
                        </CardTitle>
                        <Key className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-900">
                            {stats?.activeLicenses || 0}
                        </div>
                        <p className="text-xs text-emerald-600/80 mt-1">
                            Currently active subscriptions
                        </p>
                    </CardContent>
                </Card>

                {/* Users Stats */}
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-purple-600">
                            Total Users
                        </CardTitle>
                        <Users className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-900">
                            {stats?.totalUsers || 0}
                        </div>
                        <p className="text-xs text-purple-600/80 mt-1">
                            Staff members across all tenants
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions or Recent Activity could go here */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        System Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100 w-fit">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        All Systems Operational
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
