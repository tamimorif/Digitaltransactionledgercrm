'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import { useVerifyEmail, useResendCode } from '@/src/queries/auth.query';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { getErrorMessage } from '@/src/lib/error';

const verifySchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must be numeric'),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

export function VerifyEmailForm() {
  const router = useRouter();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendCode();
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const form = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: '',
      code: '',
    },
  });

  // Load email from localStorage if available
  useEffect(() => {
    const pendingEmail = localStorage.getItem('pending_verification_email');
    if (pendingEmail) {
      form.setValue('email', pendingEmail);
    }
  }, [form]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  async function onSubmit(data: VerifyFormValues) {
    try {
      setIsLoading(true);
      await verifyMutation.mutateAsync({
        email: data.email,
        code: data.code,
      });
      
      toast.success('Verification Successful!', {
        description: 'Your email has been verified successfully',
      });
      
      // Clear pending email
      localStorage.removeItem('pending_verification_email');
      
      router.push('/login');
    } catch (error) {
      toast.error('Verification Error', {
        description: getErrorMessage(error, 'Invalid verification code'),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    const email = form.getValues('email');
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      await resendMutation.mutateAsync({ email });
      toast.success('New Code Sent', {
        description: 'A new verification code has been sent to your email',
      });
      setCanResend(false);
      setCountdown(60);
    } catch (error) {
      toast.error('Error Sending Code', {
        description: getErrorMessage(error, 'Please try again'),
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="example@email.com"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="123456"
                    maxLength={6}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify Email
          </Button>
        </form>
      </Form>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleResendCode}
          disabled={!canResend || resendMutation.isPending}
        >
          {resendMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {canResend
            ? 'Resend Code'
            : `Resend in ${countdown} seconds`}
        </Button>

        <div className="text-center text-sm">
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
