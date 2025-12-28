'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
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
import { useActivateLicense } from '@/src/queries/license.query';
import { useAuth } from '@/src/components/providers/auth-provider';
import { toast } from 'sonner';
import { Loader2, Key } from 'lucide-react';
import { getErrorMessage } from '@/src/lib/error';

const activationSchema = z.object({
  licenseKey: z
    .string()
    .min(1, 'License key is required')
    .regex(/^[A-Za-z0-9]{2,4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}(-[A-Za-z0-9]{4})?$/, 'Invalid license key format (example: BR-xxxx-xxxx-xxxx-xxxx)'),
});

type ActivationFormValues = z.infer<typeof activationSchema>;

export function LicenseActivationCard() {
  const activateMutation = useActivateLicense();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ActivationFormValues>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      licenseKey: '',
    },
  });

  async function onSubmit(data: ActivationFormValues) {
    try {
      setIsLoading(true);
      await activateMutation.mutateAsync({
        licenseKey: data.licenseKey,
      });

      toast.success('License Activated!', {
        description: 'Your license has been successfully activated',
      });

      form.reset();

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['license-status'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      await refreshUser();

      // Small delay to let the queries refetch
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error('Activation Error', {
        description: getErrorMessage(error, 'Invalid license key'),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          <CardTitle>Activate License</CardTitle>
        </div>
        <CardDescription>
          Enter your license key to activate your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="licenseKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="BR-xxxx-xxxx-xxxx-xxxx"
                      disabled={isLoading}
                      className="font-mono"
                      maxLength={24}
                      {...field}
                      onChange={(e) => {
                        // Auto-format license key with dashes
                        const value = e.target.value.replace(/[^A-Za-z0-9-]/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Activate
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
