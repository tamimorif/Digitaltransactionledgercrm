'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import apiClient from '@/src/lib/api-client';
import { getErrorMessage } from '@/src/lib/error';

const forgotPasswordSchema = z.object({
    emailOrPhone: z.string().min(1, 'Email or phone number is required'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState(false);

    const form = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            emailOrPhone: '',
        },
    });

    async function onSubmit(data: ForgotPasswordFormValues) {
        try {
            setIsLoading(true);
            setError('');
            setSuccess(false);

            await apiClient.post('/auth/forgot-password', {
                emailOrPhone: data.emailOrPhone,
            });

            setSuccess(true);
            // Redirect to reset password page after 2 seconds
            setTimeout(() => {
                router.push('/reset-password?email=' + encodeURIComponent(data.emailOrPhone));
            }, 2000);
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to send reset code'));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/login">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
                    </div>
                    <CardDescription>
                        Enter your email or phone number to receive a password reset code
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription>
                                    Reset code sent successfully! Redirecting to reset password page...
                                </AlertDescription>
                            </Alert>
                        )}

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="emailOrPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email or Phone Number</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    placeholder="Enter your email or phone"
                                                    disabled={isLoading || success}
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        if (error) setError('');
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isLoading || success}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Reset Code
                                </Button>
                            </form>
                        </Form>

                        <div className="text-center text-sm">
                            <p className="text-muted-foreground">
                                Remember your password?{' '}
                                <Link href="/login" className="font-medium text-primary hover:underline">
                                    Back to login
                                </Link>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
