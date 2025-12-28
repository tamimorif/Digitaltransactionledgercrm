import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/src/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { FormattedInput } from '@/src/components/ui/formatted-input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTransfer } from '@/src/lib/queries/transfer.query';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import { useAuth } from '@/src/components/providers/auth-provider';
import { getErrorMessage } from '@/src/lib/error';

const formSchema = z.object({
    sourceBranchId: z.number().min(1, 'Source branch is required'),
    destinationBranchId: z.number().min(1, 'Destination branch is required'),
    amount: z.number().min(0.01, 'Amount must be greater than 0'),
    currency: z.string().min(1, 'Currency is required'),
    description: z.string().optional(),
});

interface CreateTransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateTransferDialog({ open, onOpenChange }: CreateTransferDialogProps) {
    const { user } = useAuth();
    const { data: branches } = useGetBranches();
    const createTransferMutation = useCreateTransfer();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            sourceBranchId: user?.primaryBranchId || 0,
            destinationBranchId: 0,
            amount: 0,
            currency: 'CAD',
            description: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (values.sourceBranchId === values.destinationBranchId) {
            form.setError('destinationBranchId', {
                type: 'manual',
                message: 'Cannot transfer to the same branch',
            });
            return;
        }

        try {
            await createTransferMutation.mutateAsync({
                sourceBranchId: values.sourceBranchId,
                destinationBranchId: values.destinationBranchId,
                amount: values.amount,
                currency: values.currency,
                description: values.description || '',
            });
            toast.success('Transfer initiated successfully');
            onOpenChange(false);
            form.reset();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to initiate transfer'));
        }
    };

    // Filter out source branch from destination options
    const sourceBranchId = form.watch('sourceBranchId');
    const destinationOptions = branches?.filter(b => b.id !== sourceBranchId) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>New Inter-Branch Transfer</DialogTitle>
                    <DialogDescription>
                        Transfer funds from your branch to another branch.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="sourceBranchId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Source Branch</FormLabel>
                                    <Select
                                        onValueChange={(val) => field.onChange(parseInt(val))}
                                        defaultValue={field.value.toString()}
                                        disabled={true} // Lock to user's branch for now
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select source branch" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
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

                        <FormField
                            control={form.control}
                            name="destinationBranchId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Destination Branch</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={field.value?.toString()}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select destination branch" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {destinationOptions.map((branch) => (
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

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount</FormLabel>
                                        <FormControl>
                                            <FormattedInput
                                                placeholder="0.00"
                                                value={field.value.toString()}
                                                onChange={(formatted, numeric) => field.onChange(numeric)}
                                                allowDecimals={true}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="CAD">CAD</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="EUR">EUR</SelectItem>
                                                <SelectItem value="GBP">GBP</SelectItem>
                                                <SelectItem value="IRR">IRR</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Add a note..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createTransferMutation.isPending}>
                                {createTransferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Initiate Transfer
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
