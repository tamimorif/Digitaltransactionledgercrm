'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/src/lib/i18n/config';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle, Search, User, Phone, X, Check, AlertCircle, Star, Clock, Calculator, FileText, CreditCard, Banknote } from 'lucide-react';
import { useCreatePickupTransaction, useGetPickupTransactions } from '@/src/lib/queries/pickup.query';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import { useSearchCustomers, useFindOrCreateCustomer } from '@/src/lib/queries/customer.query';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Badge } from '@/src/components/ui/badge';
import { handleNumberInput, parseFormattedNumber, formatCurrency, formatNumberWithCommas } from '@/src/lib/format';
import { TransactionPreviewDialog } from '@/src/components/TransactionPreviewDialog';
import { CalculatorWidget } from '@/src/components/CalculatorWidget';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { CashBalanceWidget } from '@/src/components/CashBalanceWidget';
import { TransactionSummaryDashboard } from '@/src/components/TransactionSummaryDashboard';
import { QuickAmountButtons } from '@/src/components/QuickAmountButtons';
import { RateHistoryDropdown } from '@/src/components/RateHistoryDropdown';
import { calculateReceivedAmount, saveRateToHistory, getLastRate, findDuplicateTransaction, formatTimeAgo } from '@/src/lib/transaction-helpers';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY'];

interface Customer {
    id: number;
    phone: string;
    fullName: string;
    email?: string;
}

interface RecentRecipient {
    name: string;
    phone: string;
    lastUsed: string;
}

export default function SendMoneyPickupPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useTranslation();

    // Redirect SuperAdmin to admin dashboard
    useEffect(() => {
        if (user?.role === 'superadmin') {
            router.push('/admin');
        }
    }, [user, router]);

    const [formData, setFormData] = useState({
        senderName: '',
        senderPhone: '',
        recipientName: '',
        recipientPhone: '',
        recipientIban: '',
        transactionType: 'CASH_PICKUP' as 'CASH_PICKUP' | 'CASH_EXCHANGE' | 'BANK_TRANSFER' | 'CARD_SWAP_IRR',
        receiverBranchId: '',
        amount: '',
        senderCurrency: '',
        receiverCurrency: '',
        exchangeRate: '1',
        fees: '',
        notes: '',
        idType: 'passport' as 'passport' | 'national_id' | 'drivers_license' | 'other',
        idNumber: '',
        allowPartialPayment: false,
    });

    // Search states
    const [senderSearchQuery, setSenderSearchQuery] = useState('');
    const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
    const [showSenderResults, setShowSenderResults] = useState(false);
    const [showRecipientResults, setShowRecipientResults] = useState(false);
    const [senderExists, setSenderExists] = useState<boolean | null>(null);
    const [recipientExists, setRecipientExists] = useState<boolean | null>(null);
    const [selectedSenderCustomer, setSelectedSenderCustomer] = useState<Customer | null>(null);
    const [selectedRecipientCustomer, setSelectedRecipientCustomer] = useState<Customer | null>(null);

    // Refs for click outside and auto-focus
    const senderSearchRef = useRef<HTMLDivElement>(null);
    const recipientSearchRef = useRef<HTMLDivElement>(null);
    const amountInputRef = useRef<HTMLInputElement>(null);
    const exchangeRateInputRef = useRef<HTMLInputElement>(null);

    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]); // Store phone numbers of favorites
    const [showPreview, setShowPreview] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

    const { data: branches } = useGetBranches();
    const createPickupMutation = useCreatePickupTransaction();
    const findOrCreateMutation = useFindOrCreateCustomer();

    // Search customers for sender
    const { data: senderSearchResults } = useSearchCustomers(senderSearchQuery);
    // Search customers for recipient
    const { data: recipientSearchResults } = useSearchCustomers(recipientSearchQuery);

    // Get recent pickups to extract recent recipients
    const { data: recentPickups } = useGetPickupTransactions(
        user?.primaryBranchId || undefined,
        'PICKED_UP',
        1,
        10
    );

    // Auto-save draft to localStorage
    useEffect(() => {
        const timer = setTimeout(() => {
            if (formData.senderName || formData.amount || formData.recipientName) {
                localStorage.setItem('transaction_draft', JSON.stringify(formData));
            }
        }, 1000); // Save after 1 second of inactivity

        return () => clearTimeout(timer);
    }, [formData]);

    // Restore draft on mount (only if it has meaningful data)
    useEffect(() => {
        const draft = localStorage.getItem('transaction_draft');
        if (draft) {
            try {
                const parsedDraft = JSON.parse(draft);
                // Only prompt if draft has actual transaction data (not just default values)
                const hasData = parsedDraft.senderName ||
                    parsedDraft.senderPhone?.length > 3 ||
                    parsedDraft.amount ||
                    parsedDraft.recipientName;

                if (hasData) {
                    if (confirm('You have an unsaved transaction draft. Would you like to restore it?')) {
                        setFormData(parsedDraft);
                    } else {
                        localStorage.removeItem('transaction_draft');
                    }
                } else {
                    // Clean up empty drafts
                    localStorage.removeItem('transaction_draft');
                }
            } catch (e) {
                localStorage.removeItem('transaction_draft');
            }
        }
    }, []);

    // Extract recent recipients from pickups
    useEffect(() => {
        if (recentPickups?.data) {
            const recipients = recentPickups.data
                .filter(pickup => pickup.recipientPhone) // Only show recipients with phone numbers
                .slice(0, 5)
                .map(pickup => ({
                    name: pickup.recipientName,
                    phone: pickup.recipientPhone!,
                    lastUsed: pickup.createdAt
                }));
            setRecentRecipients(recipients);
        }
    }, [recentPickups]);

    // Load favorites from localStorage
    useEffect(() => {
        const savedFavorites = localStorage.getItem('favoriteRecipients');
        if (savedFavorites) {
            setFavorites(JSON.parse(savedFavorites));
        }
    }, []);

    // Auto-set Card Currency to IRR for Card Swap transactions
    useEffect(() => {
        if (formData.transactionType === 'CARD_SWAP_IRR' && formData.senderCurrency !== 'IRR') {
            setFormData(prev => ({
                ...prev,
                senderCurrency: 'IRR',
            }));
        }
    }, [formData.transactionType]);

    // Auto-load last used rate for Card Swap
    useEffect(() => {
        if (formData.transactionType === 'CARD_SWAP_IRR' && formData.receiverCurrency && formData.receiverCurrency !== 'IRR') {
            const lastRate = getLastRate('IRR', formData.receiverCurrency);
            if (lastRate && !formData.exchangeRate) {
                setFormData(prev => ({ ...prev, exchangeRate: lastRate }));
            }
        }
    }, [formData.transactionType, formData.receiverCurrency]);

    // Handle click outside to close search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (senderSearchRef.current && !senderSearchRef.current.contains(event.target as Node)) {
                setShowSenderResults(false);
            }
            if (recipientSearchRef.current && !recipientSearchRef.current.contains(event.target as Node)) {
                setShowRecipientResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Check if customer exists when typing
    useEffect(() => {
        if (formData.senderPhone.length >= 10) {
            const exists = senderSearchResults?.some(c => c.phone === formData.senderPhone);
            setSenderExists(exists || false);
        } else {
            setSenderExists(null);
        }
    }, [formData.senderPhone, senderSearchResults]);

    useEffect(() => {
        if (formData.recipientPhone.length >= 10) {
            const exists = recipientSearchResults?.some(c => c.phone === formData.recipientPhone);
            setRecipientExists(exists || false);
        } else {
            setRecipientExists(null);
        }
    }, [formData.recipientPhone, recipientSearchResults]);

    // Auto-set IRR for Card Swap transactions
    useEffect(() => {
        if (formData.transactionType === 'CARD_SWAP_IRR') {
            setFormData(prev => ({
                ...prev,
                senderCurrency: 'IRR',
                recipientName: prev.senderName, // Same person
                recipientPhone: prev.senderPhone,
            }));
        }
    }, [formData.transactionType, formData.senderName, formData.senderPhone]);

    // Auto-load last used rate for Card Swap
    useEffect(() => {
        if (formData.transactionType === 'CARD_SWAP_IRR' && formData.receiverCurrency && formData.receiverCurrency !== 'IRR') {
            const lastRate = getLastRate('IRR', formData.receiverCurrency);
            if (lastRate) {
                setFormData(prev => ({ ...prev, exchangeRate: lastRate }));
            }
        }
    }, [formData.transactionType, formData.receiverCurrency]);

    // Auto-set receiver currency for CASH_EXCHANGE (transfer - same currency)
    useEffect(() => {
        if (formData.transactionType === 'CASH_EXCHANGE' && formData.senderCurrency) {
            setFormData(prev => ({
                ...prev,
                receiverCurrency: prev.senderCurrency,
                exchangeRate: '1'
            }));
        }
    }, [formData.transactionType, formData.senderCurrency]);

    // Auto-set IRR currency for CARD_SWAP_IRR
    useEffect(() => {
        if (formData.transactionType === 'CARD_SWAP_IRR') {
            setFormData(prev => ({
                ...prev,
                senderCurrency: 'IRR'
            }));
        }
    }, [formData.transactionType]);

    // Auto-load last used rate for currency pair
    useEffect(() => {
        if (formData.senderCurrency && formData.receiverCurrency && formData.senderCurrency !== formData.receiverCurrency) {
            const lastRate = getLastRate(formData.senderCurrency, formData.receiverCurrency);
            if (lastRate && (!formData.exchangeRate || formData.exchangeRate === '1')) {
                setFormData(prev => ({ ...prev, exchangeRate: lastRate || '1' }));
            }
        }
    }, [formData.senderCurrency, formData.receiverCurrency]);

    // Duplicate detection
    useEffect(() => {
        if (formData.senderName && formData.amount && formData.senderCurrency && recentPickups?.data) {
            const duplicate = findDuplicateTransaction(
                formData.senderName,
                formData.amount,
                formData.senderCurrency,
                recentPickups.data,
                10 // 10 minutes
            );
            setDuplicateWarning(duplicate);
        } else {
            setDuplicateWarning(null);
        }
    }, [formData.senderName, formData.amount, formData.senderCurrency, recentPickups]);

    // Format phone number as user types
    const formatPhoneNumber = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        return cleaned;
    };

    // Handle sender search (search by name - show results after 2 characters)
    const handleSenderSearch = (value: string) => {
        setSenderSearchQuery(value);
        setFormData({ ...formData, senderName: value });
        setShowSenderResults(value.length >= 2);
    };

    const handleSenderPhoneSearch = (value: string) => {
        const formatted = formatPhoneNumber(value);
        setSenderSearchQuery(formatted);
        setFormData({ ...formData, senderPhone: formatted });
        setShowSenderResults(formatted.length >= 3);
    };

    const selectSenderCustomer = (customer: Customer) => {
        setSelectedSenderCustomer(customer);
        setFormData({
            ...formData,
            senderName: customer.fullName,
            senderPhone: customer.phone
        });
        setSenderExists(true);
        setShowSenderResults(false);
        toast.success('Sender information filled from system');
        // Auto-focus amount field for Card Swap
        setTimeout(() => {
            if (formData.transactionType === 'CARD_SWAP_IRR') {
                amountInputRef.current?.focus();
            }
        }, 100);
    };

    // Handle recipient search (search by name - show results after 2 characters)
    const handleRecipientSearch = (value: string) => {
        setRecipientSearchQuery(value);
        setFormData({ ...formData, recipientName: value });
        setShowRecipientResults(value.length >= 2);
    };

    const handleRecipientPhoneSearch = (value: string) => {
        const formatted = formatPhoneNumber(value);
        setRecipientSearchQuery(formatted);
        setFormData({ ...formData, recipientPhone: formatted });
        setShowRecipientResults(formatted.length >= 3);
    };

    const selectRecipientCustomer = (customer: Customer) => {
        setSelectedRecipientCustomer(customer);
        setFormData({
            ...formData,
            recipientName: customer.fullName,
            recipientPhone: customer.phone
        });
        setRecipientExists(true);
        setShowRecipientResults(false);
        toast.success('Recipient information filled from system');
    };

    // Quick select recent recipient
    const selectRecentRecipient = (recipient: RecentRecipient) => {
        setFormData({
            ...formData,
            recipientName: recipient.name,
            recipientPhone: recipient.phone
        });
        setRecipientExists(true);
        toast.success('Recent recipient selected');
    };

    // Toggle favorite
    const toggleFavorite = (phone: string) => {
        const newFavorites = favorites.includes(phone)
            ? favorites.filter(f => f !== phone)
            : [...favorites, phone];
        setFavorites(newFavorites);
        localStorage.setItem('favoriteRecipients', JSON.stringify(newFavorites));
        toast.success(favorites.includes(phone) ? 'Removed from favorites' : 'Added to favorites');
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            // Ctrl+S or Cmd+S to submit
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                setShowPreview(true);
            }
            // Escape to clear
            if (e.key === 'Escape' && !showPreview) {
                if (confirm('Clear the form?')) {
                    clearForm();
                }
            }
            // Ctrl+K or Cmd+K to toggle calculator
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowCalculator(!showCalculator);
            }
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [showPreview, showCalculator]);

    const clearForm = () => {
        setFormData({
            senderName: '',
            senderPhone: '',
            recipientName: '',
            recipientPhone: '',
            recipientIban: '',
            transactionType: 'CASH_PICKUP',
            receiverBranchId: '',
            amount: '',
            senderCurrency: '',
            receiverCurrency: '',
            exchangeRate: '1',
            fees: '0',
            notes: '',
            idType: 'passport',
            idNumber: '',
            allowPartialPayment: false,
        });
        setSenderExists(null);
        setRecipientExists(null);
        setSelectedSenderCustomer(null);
        setSelectedRecipientCustomer(null);
        setDuplicateWarning(null);
        localStorage.removeItem('transaction_draft');
        toast.success(t('transaction.validation.fillRequired'));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setShowPreview(true);
    };

    const handleConfirmTransaction = async () => {
        // Basic validation
        if (!formData.senderName || !formData.senderPhone ||
            !formData.amount || !formData.senderCurrency || !formData.receiverCurrency || !formData.fees) {
            toast.error('Please fill in all required fields');
            return;
        }

        // Recipient name required for transfers (CASH_EXCHANGE, BANK_TRANSFER) - optional for in-person (CASH_PICKUP, CARD_SWAP_IRR)
        if ((formData.transactionType === 'CASH_EXCHANGE' || formData.transactionType === 'BANK_TRANSFER') && !formData.recipientName) {
            toast.error('Please enter recipient name');
            return;
        }

        // Receiver branch required only for BANK_TRANSFER (other types use same branch)
        if (formData.transactionType === 'BANK_TRANSFER' && !formData.receiverBranchId) {
            toast.error('Please select a receiving branch');
            return;
        }

        // Validate phone numbers
        if (formData.senderPhone.length < 10) {
            toast.error('Please enter a valid sender phone number');
            return;
        }

        // Recipient phone required only for CASH_EXCHANGE (transfers between branches)
        if (formData.transactionType === 'CASH_EXCHANGE' && (!formData.recipientPhone || formData.recipientPhone.length < 10)) {
            toast.error('Please enter a valid recipient phone number for branch transfer');
            return;
        }

        // IBAN required for BANK_TRANSFER
        if (formData.transactionType === 'BANK_TRANSFER') {
            if (!formData.recipientIban || formData.recipientIban.length !== 26) {
                toast.error('Please enter a valid 26-character Iranian IBAN');
                return;
            }
            if (!formData.recipientIban.startsWith('IR')) {
                toast.error('IBAN must start with IR');
                return;
            }
        }

        // For branch users, use their primary branch. For owners, use their primary branch (Head Office)
        let senderBranchId = user?.primaryBranchId;

        // Fallback: If no primaryBranchId (for existing users), use the first available branch
        if (!senderBranchId && branches && branches.length > 0) {
            senderBranchId = branches[0].id;
        }

        if (!senderBranchId) {
            toast.error('No branches available. Please create your Head Office branch first.');
            return;
        }

        // For in-person exchanges (CASH_PICKUP, CASH_EXCHANGE) and Card Swap (CARD_SWAP_IRR), use same branch (sender = receiver)
        // For other types (BANK_TRANSFER), ensure branches are different
        let receiverBranchId: number;
        if (formData.transactionType === 'CASH_PICKUP' || formData.transactionType === 'CARD_SWAP_IRR' || formData.transactionType === 'CASH_EXCHANGE') {
            receiverBranchId = senderBranchId;
        } else {
            receiverBranchId = parseInt(formData.receiverBranchId);
            if (senderBranchId === receiverBranchId) {
                toast.error('Cannot send money to the same branch. Please select a different receiving branch.');
                return;
            }
        }

        // Calculate receiver amount based on exchange rate
        const senderAmount = parseFloat(formData.amount);
        const exchangeRate = parseFloat(formData.exchangeRate);
        const isCardSwap = formData.transactionType === 'CARD_SWAP_IRR';
        const receiverAmount = calculateReceivedAmount(senderAmount, exchangeRate, isCardSwap);

        try {
            // Auto-create sender if doesn't exist
            if (!senderExists) {
                toast.info('Creating new customer for sender...');
                await findOrCreateMutation.mutateAsync({
                    phone: formData.senderPhone,
                    fullName: formData.senderName,
                });
            }

            // Auto-create recipient if doesn't exist and phone is provided
            if (!recipientExists && formData.recipientPhone && formData.recipientPhone.length >= 10) {
                toast.info('Creating new customer for recipient...');
                await findOrCreateMutation.mutateAsync({
                    phone: formData.recipientPhone,
                    fullName: formData.recipientName,
                });
            }

            // Create pickup transaction
            const response = await createPickupMutation.mutateAsync({
                senderName: formData.senderName,
                senderPhone: formData.senderPhone,
                senderBranchId: senderBranchId,
                recipientName: formData.recipientName || formData.senderName, // Use sender name for in-person exchanges
                recipientPhone: formData.recipientPhone || undefined,
                recipientIban: formData.recipientIban || undefined,
                transactionType: formData.transactionType,
                receiverBranchId: receiverBranchId, // Use the calculated variable
                amount: senderAmount,
                currency: formData.senderCurrency,
                receiverCurrency: formData.receiverCurrency,
                exchangeRate: exchangeRate,
                receiverAmount: receiverAmount,
                fees: parseFloat(formData.fees),
                notes: formData.notes || undefined,
                allowPartialPayment: formData.allowPartialPayment,
                totalReceived: formData.allowPartialPayment ? receiverAmount : undefined,
                receivedCurrency: formData.allowPartialPayment ? formData.receiverCurrency : undefined,
            });

            // Save rate to history for future reuse
            if (formData.senderCurrency && formData.receiverCurrency && formData.exchangeRate) {
                saveRateToHistory(formData.senderCurrency, formData.receiverCurrency, formData.exchangeRate);
            }

            setGeneratedCode(response.pickupCode);
            setShowPreview(false);
            localStorage.removeItem('transaction_draft');
            toast.success(t(`transaction.success.${formData.transactionType}`));

            // Reset form and states
            clearForm();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create money transfer');
        }
    };

    const handleCreateAnother = () => {
        setGeneratedCode(null);
    };

    // Don't render for SuperAdmin
    if (user?.role === 'superadmin') {
        return null;
    }

    if (generatedCode) {
        return (
            <div className="container max-w-2xl mx-auto py-8 space-y-6">
                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <CheckCircle className="h-16 w-16 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl text-green-900">{t(`transaction.success.${formData.transactionType}`)}</CardTitle>
                        <CardDescription className="text-green-700">
                            {t('transaction.success.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-white border-2 border-green-300 rounded-lg p-8 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Pickup Code</p>
                            <p className="text-5xl font-bold text-green-600 tracking-widest">{generatedCode}</p>
                        </div>

                        <Alert>
                            <AlertDescription>
                                The recipient can use this code at the receiving branch to collect the money.
                                They will need to provide this code and verify their phone number.
                            </AlertDescription>
                        </Alert>

                        <Button onClick={handleCreateAnother} className="w-full">
                            {t('transaction.buttons.createAnother')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto py-8 space-y-6">
            {/* Language Toggle */}
            <div className="flex justify-end">
                <LanguageToggle />
            </div>

            {/* Transaction Summary Dashboard */}
            {recentPickups?.data && recentPickups.data.length > 0 && (
                <TransactionSummaryDashboard transactions={recentPickups.data} />
            )}

            {/* Cash Balance Widget */}
            <CashBalanceWidget />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">
                        {t(`transaction.types.${formData.transactionType}`)}
                    </h1>
                    <p className="text-muted-foreground">
                        {t(`transaction.descriptions.${formData.transactionType}`)}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="overflow-visible">
                    <CardHeader>
                        <CardTitle>
                            {formData.transactionType === 'CASH_PICKUP' ? t('transaction.sections.customerInfo') :
                                formData.transactionType === 'CARD_SWAP_IRR' ? t('transaction.sections.cardholderInfo') :
                                    t('transaction.sections.senderRecipientInfo')}
                        </CardTitle>
                        <CardDescription>
                            {formData.transactionType === 'CASH_PICKUP' ? t('transaction.sections.customerInfoDesc') :
                                formData.transactionType === 'CARD_SWAP_IRR' ? t('transaction.sections.cardholderInfoDesc') :
                                    t('transaction.sections.senderRecipientDesc')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 overflow-visible">
                        {/* Sender Name with Search */}
                        <div className="space-y-2 relative" ref={senderSearchRef}>
                            <Label htmlFor="senderName">
                                {formData.transactionType === 'CASH_PICKUP' ? t('transaction.labels.customerName') :
                                    formData.transactionType === 'CARD_SWAP_IRR' ? t('transaction.labels.cardholderName') :
                                        t('transaction.labels.senderName')} *
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="senderName"
                                    value={formData.senderName}
                                    onChange={(e) => handleSenderSearch(e.target.value)}
                                    onFocus={() => setShowSenderResults(senderSearchQuery.length >= 2)}
                                    placeholder={t('transaction.placeholders.searchCustomer')}
                                    className="pl-10 pr-10"
                                    required
                                />
                                {senderExists !== null && (
                                    <div className="absolute right-3 top-3">
                                        {senderExists ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-amber-600" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {senderExists !== null && (
                                <div className="flex items-center justify-between">
                                    <Badge variant={senderExists ? "default" : "secondary"} className="text-xs">
                                        {senderExists ? t('transaction.helpers.customerExists') : t('transaction.helpers.newCustomer')}
                                    </Badge>
                                    {formData.senderPhone && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleFavorite(formData.senderPhone)}
                                            className="h-6"
                                        >
                                            <Star className={`h-4 w-4 ${favorites.includes(formData.senderPhone) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            )}
                            {/* Search Results Dropdown */}
                            {showSenderResults && senderSearchResults && senderSearchResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                    <div className="p-2 text-xs text-muted-foreground border-b bg-blue-50 dark:bg-blue-950">
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            <span className="font-medium">{senderSearchResults.length} customer{senderSearchResults.length !== 1 ? 's' : ''} found</span>
                                        </div>
                                    </div>
                                    {senderSearchResults.map((customer) => (
                                        <div
                                            key={customer.id}
                                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b last:border-b-0 group"
                                            onClick={() => selectSenderCustomer(customer)}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{customer.fullName}</p>
                                                        <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {favorites.includes(customer.phone) && (
                                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                    )}
                                                    <Check className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sender Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="senderPhone">
                                {formData.transactionType === 'CASH_PICKUP' ? t('transaction.labels.customerPhone') :
                                    formData.transactionType === 'CARD_SWAP_IRR' ? t('transaction.labels.cardholderPhone') :
                                        t('transaction.labels.senderPhone')} *
                            </Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="senderPhone"
                                    value={formData.senderPhone}
                                    onChange={(e) => handleSenderPhoneSearch(e.target.value)}
                                    placeholder={t('transaction.placeholders.phone')}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        {/* ID Verification (Card Swap Only - Optional) */}
                        {formData.transactionType === 'CARD_SWAP_IRR' && (
                            <div className="grid grid-cols-2 gap-4 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="space-y-2">
                                    <Label htmlFor="idType">{t('transaction.labels.idType')} (Optional)</Label>
                                    <Select
                                        value={formData.idType}
                                        onValueChange={(value: any) => setFormData({ ...formData, idType: value })}
                                    >
                                        <SelectTrigger id="idType">
                                            <SelectValue placeholder="Select ID type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="passport">{t('transaction.idTypes.passport')}</SelectItem>
                                            <SelectItem value="national_id">{t('transaction.idTypes.national_id')}</SelectItem>
                                            <SelectItem value="drivers_license">{t('transaction.idTypes.drivers_license')}</SelectItem>
                                            <SelectItem value="other">{t('transaction.idTypes.other')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="idNumber">{t('transaction.labels.idNumber')} (Optional)</Label>
                                    <Input
                                        id="idNumber"
                                        value={formData.idNumber}
                                        onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                                        placeholder={t('transaction.placeholders.idNumber')}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Hide Recent Recipients for in-person transactions */}
                        {formData.transactionType !== 'CASH_PICKUP' && formData.transactionType !== 'CARD_SWAP_IRR' && (
                            <>
                                <div className="border-t my-4" />

                                {/* Recent Recipients Quick Select */}
                                {recentRecipients.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            {t('transaction.helpers.recentRecipients')}
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {recentRecipients.map((recipient, index) => (
                                                <Button
                                                    key={index}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => selectRecentRecipient(recipient)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <User className="h-3 w-3" />
                                                    <span>{recipient.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {recipient.phone.slice(-4)}
                                                    </span>
                                                    {favorites.includes(recipient.phone) && (
                                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                    )}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Recipient Name with Search (Not needed for Currency Exchange or Card Swap) */}
                        {formData.transactionType !== 'CASH_PICKUP' && formData.transactionType !== 'CARD_SWAP_IRR' && (
                            <div className="space-y-2 relative" ref={recipientSearchRef}>
                                <Label htmlFor="recipientName">Recipient Name *</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="recipientName"
                                        value={formData.recipientName}
                                        onChange={(e) => handleRecipientSearch(e.target.value)}
                                        onFocus={() => setShowRecipientResults(recipientSearchQuery.length >= 2)}
                                        placeholder="Type name to search existing customers (e.g., Tamim)"
                                        className="pl-10 pr-10"
                                        required
                                    />
                                    {recipientExists !== null && (
                                        <div className="absolute right-3 top-3">
                                            {recipientExists ? (
                                                <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                            )}
                                        </div>
                                    )}
                                </div>
                                {recipientExists !== null && (
                                    <div className="flex items-center justify-between">
                                        <Badge variant={recipientExists ? "default" : "secondary"} className="text-xs">
                                            {recipientExists ? "✓ Found in system" : "⚠️ New customer will be created"}
                                        </Badge>
                                        {formData.recipientPhone && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleFavorite(formData.recipientPhone)}
                                                className="h-6"
                                            >
                                                <Star className={`h-4 w-4 ${favorites.includes(formData.recipientPhone) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {/* Search Results Dropdown */}
                                {showRecipientResults && recipientSearchResults && recipientSearchResults.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                        <div className="p-2 text-xs text-muted-foreground border-b bg-blue-50 dark:bg-blue-950">
                                            <div className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                <span className="font-medium">{recipientSearchResults.length} customer{recipientSearchResults.length !== 1 ? 's' : ''} found</span>
                                            </div>
                                        </div>
                                        {recipientSearchResults.map((customer) => (
                                            <div
                                                key={customer.id}
                                                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b last:border-b-0 group"
                                                onClick={() => selectRecipientCustomer(customer)}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                                            <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{customer.fullName}</p>
                                                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {favorites.includes(customer.phone) && (
                                                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                        )}
                                                        <Check className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recipient Phone (Not needed for Currency Exchange or Card Swap) */}
                        {formData.transactionType !== 'CASH_PICKUP' && formData.transactionType !== 'CARD_SWAP_IRR' && (
                            <div className="space-y-2">
                                <Label htmlFor="recipientPhone">
                                    Recipient Phone {formData.transactionType === 'BANK_TRANSFER' ? '(Optional)' : '*'}
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="recipientPhone"
                                        type="tel"
                                        value={formData.recipientPhone}
                                        onChange={(e) => handleRecipientPhoneSearch(e.target.value)}
                                        placeholder="+1234567890"
                                        className="pl-10"
                                        required={formData.transactionType !== 'BANK_TRANSFER'}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {formData.transactionType === 'BANK_TRANSFER'
                                        ? 'Optional contact number for the recipient'
                                        : 'This will be used for verification at pickup'}
                                </p>
                            </div>
                        )}

                        {/* Transaction Type */}
                        <div className="space-y-2">
                            <Label htmlFor="transactionType">Transaction Type *</Label>
                            <Select
                                value={formData.transactionType}
                                onValueChange={(value: any) => setFormData({ ...formData, transactionType: value })}
                            >
                                <SelectTrigger id="transactionType">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CASH_PICKUP">💱 Walk-In Exchange</SelectItem>
                                    <SelectItem value="CARD_SWAP_IRR">💳 Card Cash-Out (Iran)</SelectItem>
                                    <SelectItem value="CASH_EXCHANGE">📤 Send to Branch</SelectItem>
                                    <SelectItem value="BANK_TRANSFER">🏦 Bank Transfer (Iran)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {formData.transactionType === 'CASH_PICKUP' && 'Customer exchanges one currency for another and receives cash in hand'}
                                {formData.transactionType === 'CARD_SWAP_IRR' && 'Customer swipes Iranian debit card, you give them cash in their chosen currency'}
                                {formData.transactionType === 'CASH_EXCHANGE' && 'Send money to another branch for recipient to pick up later'}
                                {formData.transactionType === 'BANK_TRANSFER' && 'Transfer money directly to recipient\'s Iranian bank account'}
                            </p>
                        </div>

                        {/* IBAN for Bank Transfer */}
                        {formData.transactionType === 'BANK_TRANSFER' && (
                            <div className="space-y-2">
                                <Label htmlFor="recipientIban">Recipient IBAN *</Label>
                                <Input
                                    id="recipientIban"
                                    type="text"
                                    value={formData.recipientIban}
                                    onChange={(e) => setFormData({ ...formData, recipientIban: e.target.value.toUpperCase() })}
                                    placeholder="IR123456789012345678901234"
                                    maxLength={26}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Iranian IBAN (must start with IR, 26 characters)
                                </p>
                            </div>
                        )}

                        {/* Receiver Branch (Only for Cash Transfer and Bank Deposit, NOT for Currency Exchange or Card Swap) */}
                        {formData.transactionType !== 'CASH_PICKUP' && formData.transactionType !== 'CARD_SWAP_IRR' && (
                            <div className="space-y-2">
                                <Label htmlFor="receiverBranch">Receiving Branch *</Label>
                                <Select
                                    value={formData.receiverBranchId}
                                    onValueChange={(value) => setFormData({ ...formData, receiverBranchId: value })}
                                >
                                    <SelectTrigger id="receiverBranch">
                                        <SelectValue placeholder="Select branch where money will be picked up" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches?.map((branch: any) => (
                                            <SelectItem key={branch.id} value={branch.id.toString()}>
                                                {branch.name} ({branch.branchCode})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Duplicate Transaction Warning */}
                        {duplicateWarning && (
                            <Alert variant="destructive" className="bg-yellow-50 border-yellow-300">
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-800">
                                    <strong>{t('transaction.notices.duplicateWarning')}</strong>
                                    <br />
                                    {t('transaction.notices.duplicateDesc', {
                                        name: duplicateWarning.senderName,
                                        amount: formatCurrency(duplicateWarning.amount),
                                        currency: duplicateWarning.currency,
                                        time: formatTimeAgo(duplicateWarning.createdAt)
                                    })}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Max Transaction Limit Warning for Card Swap */}
                        {formData.transactionType === 'CARD_SWAP_IRR' && formData.amount && parseFloat(formData.amount) > 100000000 && (
                            <Alert className="bg-orange-50 border-orange-300">
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-800">
                                    <strong>High Amount Alert</strong>
                                    <br />
                                    Transaction amount ({formatNumberWithCommas(formData.amount)} Toman) exceeds 100M Toman. Please verify customer identity and ensure compliance with regulations.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Walk-In Exchange Notice */}
                        {formData.transactionType === 'CASH_PICKUP' && (
                            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                    💱 Walk-In Exchange
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    Customer brings one currency, leaves with another currency in cash
                                </p>
                            </div>
                        )}

                        {/* Card Cash-Out Notice */}
                        {formData.transactionType === 'CARD_SWAP_IRR' && (
                            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800 space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                        💳 Card Cash-Out (In-Person)
                                    </p>
                                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                        Customer swipes their Iranian debit card, you provide cash in their chosen currency
                                    </p>
                                </div>

                                {/* Step 1: Show Toman Amount */}
                                {formData.amount && formData.senderCurrency === 'IRR' && (
                                    <div className="bg-white dark:bg-gray-900 p-3 rounded border">
                                        <p className="text-xs text-muted-foreground">Step 1: Card Swiped</p>
                                        <p className="text-lg font-bold text-purple-600">{formatNumberWithCommas(formData.amount)} Toman</p>
                                    </div>
                                )}

                                {/* Step 2: Customer Receives */}
                                {formData.amount && formData.senderCurrency === 'IRR' && formData.exchangeRate && formData.receiverCurrency && (
                                    <div className="bg-white dark:bg-gray-900 p-3 rounded border border-green-300">
                                        <p className="text-xs text-muted-foreground">Customer Receives</p>
                                        <p className="text-lg font-bold text-green-600">
                                            {formatCurrency(calculateReceivedAmount(formData.amount, formData.exchangeRate, true))} {formData.receiverCurrency}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">Rate: {formatNumberWithCommas(formData.exchangeRate)} Toman = 1 {formData.receiverCurrency}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Amount and Currency */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-base font-semibold">
                                    {formData.transactionType === 'CASH_PICKUP' ? 'Amount Received from Customer' :
                                        formData.transactionType === 'CARD_SWAP_IRR' ? 'Card Amount (Toman)' :
                                            formData.transactionType === 'CASH_EXCHANGE' ? 'Amount to Send' :
                                                'Amount to Transfer'} *
                                </Label>
                                {formData.transactionType === 'CARD_SWAP_IRR' && (
                                    <p className="text-xs text-purple-600 font-medium">💳 Amount customer swiped on their Iranian card</p>
                                )}
                                <Input
                                    ref={amountInputRef}
                                    id="amount"
                                    type="text"
                                    inputMode="decimal"
                                    value={handleNumberInput(formData.amount)}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFormattedNumber(e.target.value) })}
                                    placeholder="1,000.00"
                                    required
                                />
                                {/* Quick Amount Buttons */}
                                {formData.senderCurrency && (
                                    <QuickAmountButtons
                                        currency={formData.senderCurrency}
                                        onAmountSelect={(amount) => setFormData({ ...formData, amount })}
                                    />
                                )}
                            </div>
                            {/* Hide Card Currency for Card Swap - auto-set to IRR */}
                            {formData.transactionType !== 'CARD_SWAP_IRR' && (
                                <div className="space-y-2">
                                    <Label htmlFor="senderCurrency">
                                        {formData.transactionType === 'CASH_PICKUP' ? t('transaction.labels.currencyReceived') :
                                            formData.transactionType === 'CASH_EXCHANGE' ? t('transaction.labels.currency') :
                                                t('transaction.labels.sourceCurrency')} *
                                    </Label>
                                    <Select
                                        value={formData.senderCurrency}
                                        onValueChange={(value) => setFormData({ ...formData, senderCurrency: value })}
                                    >
                                        <SelectTrigger id="senderCurrency">
                                            <SelectValue placeholder={t('transaction.placeholders.selectCurrency')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map((curr) => (
                                                <SelectItem key={curr} value={curr}>
                                                    {curr}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Receiver Currency and Exchange Rate (For Currency Exchange and Bank Deposit) */}
                        {formData.transactionType !== 'CASH_EXCHANGE' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="receiverCurrency">
                                        {formData.transactionType === 'CASH_PICKUP' ? t('transaction.labels.currencyToProvide') :
                                            formData.transactionType === 'CARD_SWAP_IRR' ? t('transaction.labels.cashPayoutCurrency') :
                                                t('transaction.labels.recipientReceives')} *
                                    </Label>
                                    <Select
                                        value={formData.receiverCurrency}
                                        onValueChange={(value) => setFormData({ ...formData, receiverCurrency: value })}
                                    >
                                        <SelectTrigger id="receiverCurrency">
                                            <SelectValue placeholder={t('transaction.placeholders.selectCurrency')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map((curr) => (
                                                <SelectItem key={curr} value={curr}>
                                                    {curr}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {formData.transactionType === 'CASH_PICKUP'
                                            ? 'Currency you will give to customer'
                                            : formData.transactionType === 'CARD_SWAP_IRR'
                                                ? 'Currency you will give as cash (CAD, USD, EUR, etc.)'
                                                : 'Recipient will receive this currency'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="exchangeRate">{t('transaction.labels.exchangeRate')} *</Label>
                                        {/* Rate History Dropdown */}
                                        {formData.senderCurrency && formData.receiverCurrency && (
                                            <RateHistoryDropdown
                                                fromCurrency={formData.senderCurrency}
                                                toCurrency={formData.receiverCurrency}
                                                onRateSelect={(rate) => setFormData({ ...formData, exchangeRate: rate })}
                                            />
                                        )}
                                    </div>
                                    <Input
                                        ref={exchangeRateInputRef}
                                        id="exchangeRate"
                                        type="text"
                                        inputMode="decimal"
                                        value={handleNumberInput(formData.exchangeRate)}
                                        onChange={(e) => {
                                            const newRate = parseFormattedNumber(e.target.value);
                                            setFormData({ ...formData, exchangeRate: newRate });
                                            // Save to history
                                            if (newRate && formData.senderCurrency && formData.receiverCurrency) {
                                                saveRateToHistory(formData.senderCurrency, formData.receiverCurrency, newRate);
                                            }
                                        }}
                                        placeholder={formData.transactionType === 'CARD_SWAP_IRR' ? '84,100' : t('transaction.placeholders.rate')}
                                        required
                                    />
                                    {/* Quick Rate Buttons for Card Swap */}
                                    {formData.transactionType === 'CARD_SWAP_IRR' && formData.receiverCurrency && formData.receiverCurrency !== 'IRR' && (
                                        <div className="flex gap-2 flex-wrap">
                                            <p className="text-xs text-muted-foreground w-full mb-1">Quick rates:</p>
                                            {formData.receiverCurrency === 'CAD' && [
                                                { label: '80,000', value: '80000' },
                                                { label: '84,100', value: '84100' },
                                                { label: '85,000', value: '85000' },
                                                { label: '90,000', value: '90000' },
                                            ].map(rate => (
                                                <Button
                                                    key={rate.value}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData({ ...formData, exchangeRate: rate.value });
                                                        saveRateToHistory('IRR', formData.receiverCurrency!, rate.value);
                                                    }}
                                                    className="h-7 text-xs"
                                                >
                                                    {rate.label}
                                                </Button>
                                            ))}
                                            {formData.receiverCurrency === 'USD' && [
                                                { label: '68,000', value: '68000' },
                                                { label: '69,500', value: '69500' },
                                                { label: '71,000', value: '71000' },
                                            ].map(rate => (
                                                <Button
                                                    key={rate.value}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData({ ...formData, exchangeRate: rate.value });
                                                        saveRateToHistory('IRR', formData.receiverCurrency!, rate.value);
                                                    }}
                                                    className="h-7 text-xs"
                                                >
                                                    {rate.label}
                                                </Button>
                                            ))}
                                            {formData.receiverCurrency === 'EUR' && [
                                                { label: '75,000', value: '75000' },
                                                { label: '77,000', value: '77000' },
                                                { label: '79,000', value: '79000' },
                                            ].map(rate => (
                                                <Button
                                                    key={rate.value}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData({ ...formData, exchangeRate: rate.value });
                                                        saveRateToHistory('IRR', formData.receiverCurrency!, rate.value);
                                                    }}
                                                    className="h-7 text-xs"
                                                >
                                                    {rate.label}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        {(() => {
                                            const isCardSwap = formData.transactionType === 'CARD_SWAP_IRR';
                                            if (formData.amount && formData.exchangeRate && formData.senderCurrency && formData.receiverCurrency) {
                                                const receivedAmount = formatCurrency(calculateReceivedAmount(formData.amount, formData.exchangeRate, isCardSwap));
                                                if (formData.transactionType === 'CASH_PICKUP') {
                                                    return t('transaction.helpers.customerReceives', { amount: receivedAmount, currency: formData.receiverCurrency });
                                                }
                                                return t('transaction.helpers.recipientReceives', { amount: receivedAmount, currency: formData.receiverCurrency });
                                            }
                                            if (isCardSwap) {
                                                return `Rate: ${formatNumberWithCommas(formData.exchangeRate || 0)} Toman = 1 ${formData.receiverCurrency || 'CAD'}`;
                                            }
                                            return `Rate: 1 ${formData.senderCurrency || 'given'} = X ${formData.receiverCurrency || 'received'}`;
                                        })()}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Cash Transfer Info (Same Currency) */}
                        {formData.transactionType === 'CASH_EXCHANGE' && formData.senderCurrency && formData.amount && (
                            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    💵 Recipient will receive: {formatCurrency(formData.amount)} {formData.senderCurrency}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Same currency transfer - No exchange rate applied
                                </p>
                            </div>
                        )}

                        {/* Fees (Not required for Currency Exchange) */}
                        <div className="space-y-2">
                            <Label htmlFor="fees">
                                {t('transaction.labels.transactionFee')} *
                            </Label>
                            <Input
                                id="fees"
                                type="text"
                                inputMode="decimal"
                                value={handleNumberInput(formData.fees)}
                                onChange={(e) => setFormData({ ...formData, fees: parseFormattedNumber(e.target.value) })}
                                placeholder="0.00"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                {formData.transactionType === 'CASH_PICKUP'
                                    ? 'Fees charged for currency exchange'
                                    : 'Fees charged for this transfer'}
                            </p>
                        </div>

                        {/* Payment Mode Selection */}
                        <Card className="border-2 border-dashed">
                            <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="allowPartialPayment"
                                        checked={formData.allowPartialPayment}
                                        onChange={(e) => setFormData({ ...formData, allowPartialPayment: e.target.checked })}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <Label htmlFor="allowPartialPayment" className="cursor-pointer font-semibold">
                                            💳 Enable Multi-Payment Mode
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Check this if the customer will pay in multiple installments or different currencies. 
                                            You can add payments after creating the transaction.
                                        </p>
                                        {formData.allowPartialPayment && (
                                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
                                                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                                                    ℹ️ This transaction will be created in <strong>OPEN</strong> status
                                                </p>
                                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                                    After creation, you can manage multiple payments in the transaction detail page. 
                                                    The transaction will automatically track total received, remaining balance, and allow completion when fully paid.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any additional information..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex gap-3 mt-6">
                    <Button type="submit" disabled={createPickupMutation.isPending || findOrCreateMutation.isPending} className="flex-1">
                        {(createPickupMutation.isPending || findOrCreateMutation.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Send className="mr-2 h-4 w-4" />
                        {formData.transactionType === 'CASH_PICKUP' ? t('transaction.buttons.completeExchange') :
                            formData.transactionType === 'CARD_SWAP_IRR' ? t('transaction.buttons.completeCashOut') :
                                formData.transactionType === 'BANK_TRANSFER' ? t('transaction.buttons.sendToBankAccount') : t('transaction.buttons.createTransfer')}
                    </Button>
                    <Button type="button" variant="outline" onClick={clearForm}>
                        {t('transaction.buttons.clear')}
                    </Button>
                </div>

                {/* Keyboard Shortcuts Help */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border text-xs text-muted-foreground">
                    <p className="font-medium mb-1">⌨️ Keyboard Shortcuts:</p>
                    <div className="grid grid-cols-2 gap-2">
                        <span>• <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border">Ctrl/Cmd + S</kbd> Review transaction</span>
                        <span>• <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border">Ctrl/Cmd + K</kbd> Toggle calculator</span>
                        <span>• <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border">Esc</kbd> Clear form</span>
                        <span>• Auto-saves every second</span>
                    </div>
                </div>
            </form>

            {/* Calculator Widget */}
            {showCalculator && (
                <div className="mt-6">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCalculator(false)}
                        className="mb-3"
                    >
                        Hide Calculator
                    </Button>
                    <CalculatorWidget
                        onRateCalculated={(from, to, rate) => {
                            setFormData({
                                ...formData,
                                senderCurrency: from,
                                receiverCurrency: to,
                                exchangeRate: rate.toString(),
                            });
                            toast.success(`Rate applied: 1 ${from} = ${rate} ${to}`);
                        }}
                    />
                </div>
            )}

            {!showCalculator && (
                <Button
                    variant="outline"
                    onClick={() => setShowCalculator(true)}
                    className="mt-4"
                >
                    <Calculator className="mr-2 h-4 w-4" />
                    Show Calculator
                </Button>
            )}

            {/* Transaction Preview Dialog */}
            <TransactionPreviewDialog
                open={showPreview}
                onOpenChange={setShowPreview}
                onConfirm={handleConfirmTransaction}
                isSubmitting={createPickupMutation.isPending || findOrCreateMutation.isPending}
                data={{
                    transactionType: formData.transactionType,
                    senderName: formData.senderName,
                    senderPhone: formData.senderPhone,
                    recipientName: formData.recipientName,
                    recipientPhone: formData.recipientPhone,
                    recipientIban: formData.recipientIban,
                    amount: formData.amount,
                    senderCurrency: formData.senderCurrency,
                    receiverCurrency: formData.receiverCurrency,
                    exchangeRate: formData.exchangeRate,
                    receiverAmount: formData.exchangeRate && formData.amount
                        ? calculateReceivedAmount(
                            parseFloat(formData.amount),
                            parseFloat(formData.exchangeRate),
                            formData.transactionType === 'CARD_SWAP_IRR'
                        )
                        : undefined,
                    fees: formData.fees,
                    notes: formData.notes,
                    senderBranch: branches?.find((b: any) => b.id === user?.primaryBranchId)?.name,
                    receiverBranch: branches?.find((b: any) => b.id === parseInt(formData.receiverBranchId))?.name,
                    allowPartialPayment: formData.allowPartialPayment,
                }}
            />
        </div >
    );
}
