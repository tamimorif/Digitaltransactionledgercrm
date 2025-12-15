'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import { useUpdateUser } from '@/src/lib/queries/user.query';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import { User } from '@/src/lib/user-api';
import { toast } from 'sonner';

const editUserSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').optional().or(z.literal('')),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
    primaryBranchId: z.string().optional(),
    role: z.enum(['tenant_user', 'tenant_admin']).optional(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
    user: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
    const form = useForm<EditUserFormValues>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            username: user.username || '',
            email: user.email,
            password: '',
            primaryBranchId: user.primaryBranchId?.toString() || '',
            role: user.role as 'tenant_user' | 'tenant_admin',
        },
    });

    const updateUserMutation = useUpdateUser();
    const { data: branches } = useGetBranches();

    const onSubmit = async (data: EditUserFormValues) => {
        try {
            const payload: any = {};

            if (data.username && data.username !== user.username) {
                payload.username = data.username;
            }

            if (data.email && data.email !== user.email) {
                payload.email = data.email;
            }

            if (data.password && data.password !== '') {
                payload.password = data.password;
            }

            if (data.primaryBranchId !== undefined) {
                payload.primaryBranchId = data.primaryBranchId ? parseInt(data.primaryBranchId) : null;
            }

            if (data.role && data.role !== user.role) {
                payload.role = data.role;
            }

            await updateUserMutation.mutateAsync({ id: user.id, data: payload });
            toast.success('User updated successfully');
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to update user');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                        Update user information for <strong>{user.username || user.email}</strong>
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl>
                                        <Input placeholder="username" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Username for login (min 3 characters)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="user@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password (Optional)</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="Leave blank to keep current" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Only fill if you want to change the password
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a role" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="tenant_user">User</SelectItem>
                                            <SelectItem value="tenant_admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="primaryBranchId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Primary Branch</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a branch" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="">All Branches</SelectItem>
                                            {branches?.map((branch) => (
                                                <SelectItem key={branch.id} value={branch.id.toString()}>
                                                    {branch.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={updateUserMutation.isPending}>
                                {updateUserMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Update User
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
