'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, DollarSign, Percent, ArrowUpDown, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    useGetFeeRules,
    useCreateFeeRule,
    useUpdateFeeRule,
    useDeleteFeeRule,
    useCreateDefaultFeeRules,
} from '@/src/lib/queries/fee.query';
import { FeeRule, CreateFeeRuleRequest } from '@/src/lib/fee-api';
import { getErrorMessage } from '@/src/lib/error';

const FEE_TYPES = [
    { value: 'FLAT', label: 'Flat Fee', icon: DollarSign },
    { value: 'PERCENTAGE', label: 'Percentage', icon: Percent },
    { value: 'COMBINED', label: 'Flat + Percentage', icon: ArrowUpDown },
];

export function FeeManager() {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingRule, setEditingRule] = useState<FeeRule | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
    const [includeInactive, setIncludeInactive] = useState(false);

    const { data: feeRules, isLoading } = useGetFeeRules(includeInactive);
    const createMutation = useCreateFeeRule();
    const updateMutation = useUpdateFeeRule();
    const deleteMutation = useDeleteFeeRule();
    const createDefaultsMutation = useCreateDefaultFeeRules();

    const [formData, setFormData] = useState<CreateFeeRuleRequest>({
        name: '',
        description: '',
        minAmount: 0,
        maxAmount: undefined,
        sourceCurrency: '',
        destinationCountry: '',
        feeType: 'FLAT',
        flatFee: 0,
        percentageFee: 0,
        minFee: 0,
        maxFee: undefined,
        priority: 100,
        isActive: true,
    });

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            minAmount: 0,
            maxAmount: undefined,
            sourceCurrency: '',
            destinationCountry: '',
            feeType: 'FLAT',
            flatFee: 0,
            percentageFee: 0,
            minFee: 0,
            maxFee: undefined,
            priority: 100,
            isActive: true,
        });
    };

    const handleCreate = async () => {
        if (!formData.name) {
            toast.error('Rule name is required');
            return;
        }
        try {
            await createMutation.mutateAsync(formData);
            toast.success('Fee rule created successfully');
            setShowCreateDialog(false);
            resetForm();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to create fee rule'));
        }
    };

    const handleUpdate = async () => {
        if (!editingRule) return;
        try {
            await updateMutation.mutateAsync({ id: editingRule.id, data: formData });
            toast.success('Fee rule updated successfully');
            setEditingRule(null);
            resetForm();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to update fee rule'));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteMutation.mutateAsync(id);
            toast.success('Fee rule deleted successfully');
            setShowDeleteConfirm(null);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to delete fee rule'));
        }
    };

    const handleCreateDefaults = async () => {
        try {
            await createDefaultsMutation.mutateAsync();
            toast.success('Default fee rules created');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to create default rules'));
        }
    };

    const openEdit = (rule: FeeRule) => {
        setFormData({
            name: rule.name,
            description: rule.description,
            minAmount: rule.minAmount,
            maxAmount: rule.maxAmount,
            sourceCurrency: rule.sourceCurrency,
            destinationCountry: rule.destinationCountry,
            feeType: rule.feeType,
            flatFee: rule.flatFee,
            percentageFee: rule.percentageFee,
            minFee: rule.minFee,
            maxFee: rule.maxFee,
            priority: rule.priority,
            isActive: rule.isActive,
        });
        setEditingRule(rule);
    };

    const formatFee = (rule: FeeRule) => {
        switch (rule.feeType) {
            case 'FLAT':
                return `$${rule.flatFee.toFixed(2)}`;
            case 'PERCENTAGE':
                return `${(rule.percentageFee * 100).toFixed(2)}%`;
            case 'COMBINED':
                return `$${rule.flatFee.toFixed(2)} + ${(rule.percentageFee * 100).toFixed(2)}%`;
            default:
                return 'N/A';
        }
    };

    const formatAmountRange = (rule: FeeRule) => {
        if (rule.maxAmount) {
            return `$${rule.minAmount.toLocaleString()} - $${rule.maxAmount.toLocaleString()}`;
        }
        return `$${rule.minAmount.toLocaleString()}+`;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Fee Manager
                        </CardTitle>
                        <CardDescription>Configure dynamic fee rules for transactions</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="show-inactive"
                                checked={includeInactive}
                                onCheckedChange={setIncludeInactive}
                            />
                            <Label htmlFor="show-inactive" className="text-sm">
                                Show Inactive
                            </Label>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateDefaults}
                            disabled={createDefaultsMutation.isPending}
                        >
                            {createDefaultsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Wand2 className="mr-2 h-4 w-4" />
                            Create Defaults
                        </Button>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Rule
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : !feeRules || feeRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No fee rules configured</p>
                        <p className="text-sm mt-2">Click &quot;Create Defaults&quot; to add standard fee rules</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {feeRules
                            .sort((a, b) => a.priority - b.priority)
                            .map((rule) => (
                                <div
                                    key={rule.id}
                                    className={`p-4 rounded-lg border ${rule.isActive ? 'bg-card' : 'bg-muted/50 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold">{rule.name}</h4>
                                                <Badge variant="outline" className="text-xs">
                                                    Priority: {rule.priority}
                                                </Badge>
                                                {!rule.isActive && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </div>
                                            {rule.description && (
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    {rule.description}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Fee: </span>
                                                    <span className="font-mono font-medium">{formatFee(rule)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Amount Range: </span>
                                                    <span className="font-mono">{formatAmountRange(rule)}</span>
                                                </div>
                                                {rule.minFee > 0 && (
                                                    <div>
                                                        <span className="text-muted-foreground">Min Fee: </span>
                                                        <span className="font-mono">${rule.minFee.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {rule.maxFee && (
                                                    <div>
                                                        <span className="text-muted-foreground">Max Fee: </span>
                                                        <span className="font-mono">${rule.maxFee.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {rule.sourceCurrency && (
                                                    <div>
                                                        <span className="text-muted-foreground">Currency: </span>
                                                        <span>{rule.sourceCurrency}</span>
                                                    </div>
                                                )}
                                                {rule.destinationCountry && (
                                                    <div>
                                                        <span className="text-muted-foreground">Country: </span>
                                                        <span>{rule.destinationCountry}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowDeleteConfirm(rule.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </CardContent>

            {/* Create/Edit Dialog */}
            <Dialog
                open={showCreateDialog || editingRule !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowCreateDialog(false);
                        setEditingRule(null);
                        resetForm();
                    }
                }}
            >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? 'Edit Fee Rule' : 'Create Fee Rule'}</DialogTitle>
                        <DialogDescription>
                            Configure when this fee rule applies and how fees are calculated
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="name">Rule Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Standard Transfer Fee"
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe when this rule applies..."
                                rows={2}
                            />
                        </div>

                        {/* Amount Range */}
                        <div className="space-y-2">
                            <Label htmlFor="minAmount">Min Amount</Label>
                            <Input
                                id="minAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.minAmount}
                                onChange={(e) =>
                                    setFormData({ ...formData, minAmount: parseFloat(e.target.value) || 0 })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxAmount">Max Amount (leave empty for no limit)</Label>
                            <Input
                                id="maxAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.maxAmount || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                                    })
                                }
                            />
                        </div>

                        {/* Fee Type */}
                        <div className="col-span-2 space-y-2">
                            <Label>Fee Type</Label>
                            <Select
                                value={formData.feeType}
                                onValueChange={(value: 'FLAT' | 'PERCENTAGE' | 'COMBINED') =>
                                    setFormData({ ...formData, feeType: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FEE_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            <div className="flex items-center gap-2">
                                                <type.icon className="h-4 w-4" />
                                                {type.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Fee Values */}
                        {(formData.feeType === 'FLAT' || formData.feeType === 'COMBINED') && (
                            <div className="space-y-2">
                                <Label htmlFor="flatFee">Flat Fee ($)</Label>
                                <Input
                                    id="flatFee"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.flatFee}
                                    onChange={(e) =>
                                        setFormData({ ...formData, flatFee: parseFloat(e.target.value) || 0 })
                                    }
                                />
                            </div>
                        )}
                        {(formData.feeType === 'PERCENTAGE' || formData.feeType === 'COMBINED') && (
                            <div className="space-y-2">
                                <Label htmlFor="percentageFee">Percentage Fee (%)</Label>
                                <Input
                                    id="percentageFee"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={(formData.percentageFee || 0) * 100}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            percentageFee: (parseFloat(e.target.value) || 0) / 100,
                                        })
                                    }
                                />
                            </div>
                        )}

                        {/* Min/Max Fee Caps */}
                        <div className="space-y-2">
                            <Label htmlFor="minFee">Minimum Fee Cap ($)</Label>
                            <Input
                                id="minFee"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.minFee}
                                onChange={(e) =>
                                    setFormData({ ...formData, minFee: parseFloat(e.target.value) || 0 })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxFee">Maximum Fee Cap ($)</Label>
                            <Input
                                id="maxFee"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.maxFee || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxFee: e.target.value ? parseFloat(e.target.value) : undefined,
                                    })
                                }
                            />
                        </div>

                        {/* Filters */}
                        <div className="space-y-2">
                            <Label htmlFor="sourceCurrency">Source Currency (leave empty for all)</Label>
                            <Input
                                id="sourceCurrency"
                                value={formData.sourceCurrency}
                                onChange={(e) =>
                                    setFormData({ ...formData, sourceCurrency: e.target.value.toUpperCase() })
                                }
                                placeholder="e.g., USD"
                                maxLength={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="destinationCountry">Destination Country (leave empty for all)</Label>
                            <Input
                                id="destinationCountry"
                                value={formData.destinationCountry}
                                onChange={(e) =>
                                    setFormData({ ...formData, destinationCountry: e.target.value.toUpperCase() })
                                }
                                placeholder="e.g., IR"
                                maxLength={2}
                            />
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority (lower = higher priority)</Label>
                            <Input
                                id="priority"
                                type="number"
                                min="1"
                                value={formData.priority}
                                onChange={(e) =>
                                    setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label htmlFor="isActive">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCreateDialog(false);
                                setEditingRule(null);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={editingRule ? handleUpdate : handleCreate}
                            disabled={createMutation.isPending || updateMutation.isPending}
                        >
                            {(createMutation.isPending || updateMutation.isPending) && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {editingRule ? 'Save Changes' : 'Create Rule'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Fee Rule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this fee rule? This action will deactivate the rule.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
