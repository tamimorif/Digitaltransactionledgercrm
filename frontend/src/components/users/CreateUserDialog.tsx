'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
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
import { useCreateBranchUser, useCheckUsername } from '@/src/lib/queries/user.query';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import { toast } from 'sonner';

const createUserSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
    const [usernameToCheck, setUsernameToCheck] = useState('');
    const [checkEnabled, setCheckEnabled] = useState(false);

    const form = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            username: '',
            password: '',
        },
    });

    const createUserMutation = useCreateBranchUser();
    const { data: branches } = useGetBranches();
    const { data: usernameCheck, isLoading: isCheckingUsername } = useCheckUsername(
        usernameToCheck,
        checkEnabled && usernameToCheck.length >= 3
    );

    // Debounce username checking
    useEffect(() => {
        const username = form.watch('username');
        const timeout = setTimeout(() => {
            if (username && username.length >= 3) {
                setUsernameToCheck(username);
                setCheckEnabled(true);
            } else {
                setCheckEnabled(false);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [form.watch('username')]);

    const onSubmit = async (data: CreateUserFormValues) => {
        try {
            // Auto-generate email from username
            const payload = {
                username: data.username,
                email: `${data.username}@digitaltransactionledger.com`,
                password: data.password,
                role: 'tenant_user',
            };

            await createUserMutation.mutateAsync(payload);
            toast.success('User created successfully');
            form.reset();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to create user');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                        Create a new user account with username and password
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
                                        <div className="relative">
                                            <Input
                                                placeholder="e.g. toronto_branch"
                                                {...field}
                                            />
                                            {isCheckingUsername && (
                                                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                                            )}
                                            {!isCheckingUsername && usernameCheck && field.value.length >= 3 && (
                                                <>
                                                    {usernameCheck.available ? (
                                                        <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </FormControl>
                                    {usernameCheck && !usernameCheck.available && (
                                        <FormDescription className="text-red-500">
                                            Username taken. Try: {usernameCheck.suggestions?.join(', ')}
                                        </FormDescription>
                                    )}
                                    {usernameCheck && usernameCheck.available && (
                                        <FormDescription className="text-green-500">
                                            ✓ Username available!
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
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
                            <Button
                                type="submit"
                                disabled={createUserMutation.isPending || (usernameCheck && !usernameCheck.available)}
                            >
                                {createUserMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Create User
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
