'use client';

import { useGetMyLicenses } from '@/src/queries/license.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Loader2, Key, CheckCircle, XCircle, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function MyLicensesCard() {
    const { data: licensesData, isLoading } = useGetMyLicenses();

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    if (!licensesData || licensesData.licenses.length === 0) {
        return null;
    }

    const { licenses, totalUserLimit, currentUserCount } = licensesData;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    My Licenses
                </CardTitle>
                <CardDescription>
                    {licenses.length} active {licenses.length === 1 ? 'license' : 'licenses'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                    <div>
                        <p className="text-sm text-muted-foreground">Total User Limit</p>
                        <p className="text-2xl font-bold">
                            {totalUserLimit === 0 || totalUserLimit >= 999999 ? 'Unlimited' : totalUserLimit}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Current Users</p>
                        <p className="text-2xl font-bold">{currentUserCount}</p>
                    </div>
                </div>

                {/* License List */}
                <div className="space-y-3">
                    {licenses.map((license) => (
                        <div
                            key={license.id}
                            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant={license.status === 'active' ? 'default' : 'secondary'}>
                                        {license.licenseType}
                                    </Badge>
                                    {license.status === 'active' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-600" />
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    {license.userLimit === 0 || license.userLimit >= 999999
                                        ? 'Unlimited'
                                        : `${license.userLimit} users`}
                                </div>
                            </div>

                            <p className="font-mono text-sm mb-2">{license.licenseKey}</p>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    Activated {formatDistanceToNow(new Date(license.activatedAt!), { addSuffix: true })}
                                </span>
                                {license.expiresAt && (
                                    <span>
                                        Expires {formatDistanceToNow(new Date(license.expiresAt), { addSuffix: true })}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
