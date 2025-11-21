'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { toast } from 'sonner';
import axiosInstance from '@/src/lib/axios-config';
import { useAuth } from '@/src/components/providers/auth-provider';

export default function MigrationFixPage() {
    const { user } = useAuth();
    const [isFixing, setIsFixing] = useState(false);
    const [fixed, setFixed] = useState(false);

    const handleFixOwnerBranch = async () => {
        setIsFixing(true);
        try {
            const response = await axiosInstance.post('/migrations/fix-owner-branch');

            if (response.data.branch) {
                toast.success('Head Office branch created successfully!', {
                    description: `Branch "${response.data.branch.name}" (${response.data.branch.branchCode}) is now your primary branch`,
                });
                setFixed(true);

                // Reload the page after 2 seconds to update user context
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                toast.info(response.data.message || 'Already fixed!');
                setFixed(true);
            }
        } catch (error: any) {
            console.error('Migration error:', error);
            toast.error(error.response?.data?.error || 'Failed to create Head Office branch');
        } finally {
            setIsFixing(false);
        }
    };

    // Only show to owners without primary branch
    if (user?.role !== 'tenant_owner') {
        return (
            <div className="container mx-auto px-6 py-8">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">
                            This tool is only available to organization owners.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-6 py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Fix Owner Account</CardTitle>
                    <CardDescription>
                        Create your Head Office branch to enable sending money transfers
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {user?.primaryBranchId ? (
                        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
                            <h3 className="font-semibold text-green-900 dark:text-green-100">
                                ✅ Already Set Up
                            </h3>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                Your account already has a primary branch (ID: {user.primaryBranchId}).
                                {user.primaryBranch && ` Branch name: ${user.primaryBranch.name}`}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4">
                                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                                    ⚠️ Action Required
                                </h3>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    Your owner account was created before we added automatic Head Office branch
                                    creation. You need a Head Office branch to send money transfers.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-medium">What This Will Do:</h4>
                                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                    <li>
                                        {fixed
                                            ? '✅ Created a "Head Office" branch for your organization'
                                            : 'Create a "Head Office" branch for your organization'
                                        }
                                    </li>
                                    <li>
                                        {fixed
                                            ? '✅ Set it as your primary branch'
                                            : 'Set it as your primary branch'
                                        }
                                    </li>
                                    <li>
                                        {fixed
                                            ? '✅ Enable you to send money transfers to other branches'
                                            : 'Enable you to send money transfers to other branches'
                                        }
                                    </li>
                                    <li>
                                        {fixed
                                            ? '✅ Allow other branches to send money to you'
                                            : 'Allow other branches to send money to you'
                                        }
                                    </li>
                                </ul>
                            </div>

                            {!fixed && (
                                <Button
                                    onClick={handleFixOwnerBranch}
                                    disabled={isFixing}
                                    size="lg"
                                    className="w-full"
                                >
                                    {isFixing ? 'Creating Head Office...' : '🏢 Create My Head Office Branch'}
                                </Button>
                            )}

                            {fixed && (
                                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
                                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                                        ✅ Fixed Successfully!
                                    </h3>
                                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                        Your Head Office branch has been created. The page will reload shortly...
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">About Head Office</h4>
                        <p className="text-sm text-muted-foreground">
                            As the owner, your account represents the Head Office branch. This branch can send
                            and receive money just like any other branch, but with additional management privileges
                            to create and manage other branches in your organization.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
