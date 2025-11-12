'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Loader2, Key } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/src/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';

interface SetBranchCredentialsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    branchId: number;
    branchName: string;
    currentUsername?: string;
}

export function SetBranchCredentialsDialog({
    open,
    onOpenChange,
    branchId,
    branchName,
    currentUsername,
}: SetBranchCredentialsDialogProps) {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        username: currentUsername || '',
        password: '',
        confirmPassword: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username.trim()) {
            toast.error('Username is required');
            return;
        }

        if (!formData.password) {
            toast.error('Password is required');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsSubmitting(true);
        try {
            // Check if token exists
            const token = localStorage.getItem('auth_token');
            if (!token) {
                toast.error('Session expired. Please log in again.');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
                return;
            }

            await apiClient.put(
                `/branches/${branchId}/credentials`,
                {
                    username: formData.username,
                    password: formData.password,
                }
            );

            toast.success('Branch login credentials set successfully');
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            onOpenChange(false);

            // Reset form
            setFormData({
                username: '',
                password: '',
                confirmPassword: '',
            });
        } catch (error: any) {
            console.error('Failed to set credentials:', error);

            // Check if it's a 401 error (token expired) - but apiClient already redirected
            if (error?.response?.status === 401) {
                toast.error('Your session has expired. Redirecting to login...');
                return; // apiClient will handle the redirect
            }

            toast.error(error?.response?.data?.error || 'Failed to set credentials');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Set Branch Login
                    </DialogTitle>
                    <DialogDescription>
                        Set username and password for <strong>{branchName}</strong> to log in to the system
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="e.g., nemat_branch"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">
                            This username will be used to log in to this branch
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Minimum 6 characters"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            placeholder="Re-enter password"
                            disabled={isSubmitting}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {currentUsername ? 'Update' : 'Set'} Login
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
