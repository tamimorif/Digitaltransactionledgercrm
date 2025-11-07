'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import { toast } from 'sonner';
import { Loader2, Key } from 'lucide-react';

const activationSchema = z.object({
  licenseKey: z
    .string()
    .min(1, 'License key is required')
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid license key format (example: ABCD-1234)'),
});

type ActivationFormValues = z.infer<typeof activationSchema>;

export function LicenseActivationCard() {
  const activateMutation = useActivateLicense();
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
      
      // Refresh page to update license status
      window.location.reload();
    } catch (error: any) {
      toast.error('Activation Error', {
        description: error?.response?.data?.error || 'Invalid license key',
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
                      placeholder="XXXX-XXXX"
                      disabled={isLoading}
                      className="font-mono uppercase"
                      maxLength={9}
                      {...field}
                      onChange={(e) => {
                        // Auto-format license key
                        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (value.length > 4) {
                          value = value.slice(0, 4) + '-' + value.slice(4, 8);
                        }
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
