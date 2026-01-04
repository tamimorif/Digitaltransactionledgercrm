'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/src/lib/i18n/config';
import { useAuth } from '@/src/components/providers/auth-provider';
import {
    ArrowRightLeft, Coins, RotateCcw, ArrowDownUp, TrendingUp, Clock,
    Check, Users, Search, RefreshCw, Receipt, ArrowRight, CheckCircle,
    AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePickupTransaction, useGetPickupTransactions } from '@/src/lib/queries/pickup.query';
import { useGetBranches } from '@/src/lib/queries/branch.query';
import { useSearchCustomers, useFindOrCreateCustomer } from '@/src/lib/queries/customer.query';
import { useGetScrapedRates, useRefreshScrapedRates, type ScrapedRate } from '@/src/lib/queries/exchange-rate.query';
import { handleNumberInput, parseFormattedNumber, formatCurrency } from '@/src/lib/format';
import { calculateReceivedAmount, saveRateToHistory, getLastRate, findDuplicateTransaction, formatTimeAgo, type DuplicateCheckableTransaction } from '@/src/lib/transaction-helpers';
import { getErrorMessage } from '@/src/lib/error';
import { TransactionPreviewDialog } from '@/src/components/TransactionPreviewDialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/src/components/ui/select';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'IRR', 'AED', 'TRY', 'USDT', 'BTC', 'ETH'];
const DEFAULT_BALANCES: Record<string, number> = {
    CAD: 12450.0,
    USD: 8210.5,
    EUR: 3120.75,
    USDT: 5000.0,
    BTC: 0.125,
    ETH: 2.35,
    IRR: 1250000000,
};
const CRYPTO_CURRENCIES = ['USDT', 'BTC', 'ETH'];
const AVAILABLE_FUNDS_CURRENCIES = [
    ...CURRENCIES.filter(
        (currency) => currency !== 'CAD' && !CRYPTO_CURRENCIES.includes(currency)
    ),
    ...CRYPTO_CURRENCIES,
];
const LIVE_RATE_LABEL = 'Toman';
const CRYPTO_ICONS: Record<string, string> = {
    USDT: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png',
    BTC: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
    ETH: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
};
const CURRENCY_FLAGS: Record<string, string> = {
    USD: '🇺🇸',
    CAD: '🇨🇦',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    IRR: '🇮🇷',
    AED: '🇦🇪',
    TRY: '🇹🇷',
};

const renderCurrencyBadge = (currency: string) => {
    const code = currency.toUpperCase();
    const iconSrc = CRYPTO_ICONS[code];
    if (iconSrc) {
        return <img src={iconSrc} alt={`${code} icon`} className="w-10 h-10" />;
    }

    const flag = CURRENCY_FLAGS[code];
    if (flag) {
        return <span className="text-3xl leading-none">{flag}</span>;
    }

    return <span className="text-[10px] font-bold">{code}</span>;
};

const renderCurrencyBadgeSmall = (currency: string) => {
    const code = currency.toUpperCase();
    const iconSrc = CRYPTO_ICONS[code];
    if (iconSrc) {
        return <img src={iconSrc} alt={`${code} icon`} className="w-6 h-6" />;
    }

    const flag = CURRENCY_FLAGS[code];
    if (flag) {
        return <span className="text-xl leading-none">{flag}</span>;
    }

    return <span className="text-[9px] font-bold">{code}</span>;
};

const renderCurrencySelectValue = (currency: string) => (
    <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center">
            {renderCurrencyBadge(currency)}
        </span>
        <span className="text-base font-semibold">{currency}</span>
    </div>
);

const renderCurrencySelectValueSmall = (currency: string) => (
    <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center">
            {renderCurrencyBadgeSmall(currency)}
        </span>
        <span className="text-sm font-semibold">{currency}</span>
    </div>
);

const parseNavasanValue = (rate?: ScrapedRate) => {
    if (!rate) {
        return null;
    }
    const raw = rate.buy_rate.replace(/,/g, '');
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : null;
};

const formatCadValue = (value: number) => {
    const abs = Math.abs(value);
    const decimals = abs >= 100 ? 2 : abs >= 10 ? 3 : abs >= 1 ? 4 : abs >= 0.1 ? 5 : 6;
    return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

const formatTomanValue = (value: number) => {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatCadBasedRate = (currency: string, rateLookup: Map<string, number>) => {
    const cadRate = rateLookup.get('CAD');
    if (!cadRate || !Number.isFinite(cadRate) || cadRate <= 0) {
        return null;
    }

    const code = currency.toUpperCase();
    if (code === 'IRR') {
        return `1 CAD = ${formatTomanValue(cadRate)} ${LIVE_RATE_LABEL}`;
    }

    if (code === 'CAD') {
        return '1 CAD = 1 CAD';
    }

    const currencyRate = rateLookup.get(code);
    if (!currencyRate || !Number.isFinite(currencyRate) || currencyRate <= 0) {
        return null;
    }

    const cadPerCurrency = currencyRate / cadRate;
    if (!Number.isFinite(cadPerCurrency) || cadPerCurrency <= 0) {
        return null;
    }

    if (cadPerCurrency < 1) {
        const multiplier = 1 / cadPerCurrency;
        return `1 CAD = ${formatCadValue(multiplier)} ${code}`;
    }

    return `1 ${code} = ${formatCadValue(cadPerCurrency)} CAD`;
};

interface Customer {
    id: number;
    phone: string;
    fullName: string;
    email?: string;
}

type TransactionType = 'CASH_PICKUP' | 'CASH_EXCHANGE' | 'BANK_TRANSFER' | 'CARD_SWAP_IRR' | 'INCOMING_FUNDS';
type IdType = 'passport' | 'national_id' | 'drivers_license' | 'other';

type FormData = {
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone: string;
    recipientIban: string;
    transactionType: TransactionType;
    receiverBranchId: string;
    amount: string;
    senderCurrency: string;
    receiverCurrency: string;
    exchangeRate: string;
    fees: string;
    notes: string;
    idType: IdType;
    idNumber: string;
    allowPartialPayment: boolean;
};

export default function InitiateTransferPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useTranslation();

    // Redirect SuperAdmin
    useEffect(() => {
        if (user?.role === 'superadmin') {
            router.push('/admin');
        }
    }, [user, router]);

    // Form State
    const [formData, setFormData] = useState<FormData>({
        senderName: '',
        senderPhone: '',
        recipientName: '',
        recipientPhone: '',
        recipientIban: '',
        transactionType: 'CASH_PICKUP',
        receiverBranchId: '',
        amount: '',
        senderCurrency: 'USD',
        receiverCurrency: 'CAD',
        exchangeRate: '1.3500',
        fees: '5.00',
        notes: '',
        idType: 'passport',
        idNumber: '',
        allowPartialPayment: false,
    });

    // Search States
    const [senderSearchQuery, setSenderSearchQuery] = useState('');
    const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
    const [showSenderResults, setShowSenderResults] = useState(false);
    const [showRecipientResults, setShowRecipientResults] = useState(false);
    const senderSearchRef = useRef<HTMLDivElement>(null);
    const recipientSearchRef = useRef<HTMLDivElement>(null);

    // Other States
    const [showPreview, setShowPreview] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckableTransaction | null>(null);
    const [fundsFilter, setFundsFilter] = useState('');

    const [liveRates, setLiveRates] = useState<Record<string, string> | null>(null);
    const [availableFundsHeight, setAvailableFundsHeight] = useState<number | null>(null);
    const exchangeDetailsRef = useRef<HTMLElement | null>(null);

    // Mock balances (replace with real data if available)
    const [balances, setBalances] = useState<Record<string, number>>(DEFAULT_BALANCES);

    // Queries & Mutations
    const { data: branches } = useGetBranches();
    const createPickupMutation = useCreatePickupTransaction();
    const findOrCreateMutation = useFindOrCreateCustomer();
    const { data: senderSearchResults } = useSearchCustomers(senderSearchQuery);
    const { data: recipientSearchResults } = useSearchCustomers(recipientSearchQuery);
    const { data: recentPickups } = useGetPickupTransactions(user?.primaryBranchId || undefined, 'PICKED_UP', 1, 10);
    const { data: scrapedRatesData, refetch: refetchScrapedRates, isFetching: isFetchingScrapedRates } = useGetScrapedRates();
    const refreshScrapedRates = useRefreshScrapedRates();

    // --- Effects ---

    // Click outside search
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

    // Load recent balances
    useEffect(() => {
        const saved = localStorage.getItem('cashBalances');
        if (saved) {
            const parsed = JSON.parse(saved) as Record<string, number>;
            setBalances({ ...DEFAULT_BALANCES, ...parsed });
        }
    }, []);

    // Auto-load last used rate
    useEffect(() => {
        if (formData.senderCurrency && formData.receiverCurrency && formData.senderCurrency !== formData.receiverCurrency) {
            const lastRate = getLastRate(formData.senderCurrency, formData.receiverCurrency);
            if (lastRate) {
                setFormData(prev => ({ ...prev, exchangeRate: lastRate }));
            }
        }
    }, [formData.senderCurrency, formData.receiverCurrency]);

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

    // Duplicate detection
    useEffect(() => {
        if (formData.senderName && formData.amount && formData.senderCurrency && recentPickups?.data) {
            const duplicate = findDuplicateTransaction(
                formData.senderName,
                formData.amount,
                formData.senderCurrency,
                recentPickups.data,
                10
            );
            setDuplicateWarning(duplicate ?? null);
        } else {
            setDuplicateWarning(null);
        }
    }, [formData.senderName, formData.amount, formData.senderCurrency, recentPickups]);

    // --- Helpers ---
    const getCalculatedRecv = () => {
        const amt = parseFloat(formData.amount || "0");
        const rate = parseFloat(formData.exchangeRate || "0");
        const recv = amt * rate;
        return Number.isFinite(recv) ? recv : 0;
    };

    const getCalculatedTotal = () => {
        return getCalculatedRecv() + parseFloat(formData.fees || "0");
    };

    const formatPhoneNumber = (value: string) => {
        const cleaned = value.replace(/[^\d+]/g, '');
        if (!cleaned) {
            return '';
        }
        if (cleaned.startsWith('+')) {
            const digits = cleaned.slice(1).replace(/\+/g, '');
            return `+${digits}`;
        }
        return cleaned.replace(/\+/g, '');
    };

    useEffect(() => {
        const target = exchangeDetailsRef.current;
        if (!target || typeof ResizeObserver === 'undefined') {
            return;
        }

        const updateHeight = () => {
            if (window.innerWidth < 1024) {
                setAvailableFundsHeight(null);
                return;
            }
            const nextHeight = Math.round(target.getBoundingClientRect().height);
            setAvailableFundsHeight(nextHeight > 0 ? nextHeight : null);
        };

        updateHeight();
        const observer = new ResizeObserver(() => updateHeight());
        observer.observe(target);
        window.addEventListener('resize', updateHeight);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, []);

    const handleRefreshLiveRates = useCallback(async () => {
        let availableRates = scrapedRatesData?.rates ?? [];

        try {
            await refreshScrapedRates.mutateAsync();
            const refreshed = await refetchScrapedRates();
            availableRates = refreshed.data?.rates ?? availableRates;
            toast.success('Live rates updated');
        } catch (error) {
            toast.error('Failed to refresh live rates');
        }

        if (availableRates.length === 0) {
            toast.error('No live rates available');
            return;
        }

        const rateLookup = new Map<string, number>();
        availableRates.forEach((rate) => {
            const value = parseNavasanValue(rate);
            if (value !== null) {
                rateLookup.set(rate.currency.toUpperCase(), value);
            }
        });
        const nextRates: Record<string, string> = {};
        AVAILABLE_FUNDS_CURRENCIES.forEach((currency) => {
            const formatted = formatCadBasedRate(currency, rateLookup);
            nextRates[currency] = formatted ?? 'Rate unavailable';
        });

        setLiveRates(nextRates);
    }, [refetchScrapedRates, refreshScrapedRates, scrapedRatesData]);

    // --- Handlers ---

    const handleSwap = () => {
        setFormData(prev => ({
            ...prev,
            senderCurrency: prev.receiverCurrency,
            receiverCurrency: prev.senderCurrency
        }));
    };

    const handleSenderSearch = (val: string) => {
        setSenderSearchQuery(val);
        setFormData(prev => ({ ...prev, senderName: val }));
        setShowSenderResults(val.length >= 2);
    };

    const handleSenderPhoneSearch = (val: string) => {
        const formatted = formatPhoneNumber(val);
        setFormData(prev => ({ ...prev, senderPhone: formatted }));
    };

    const selectSenderCustomer = (c: Customer) => {
        setFormData(prev => ({
            ...prev,
            senderName: c.fullName,
            senderPhone: c.phone
        }));
        setShowSenderResults(false);
        toast.success("Sender selected");
    };

    const handleRecipientSearch = (val: string) => {
        setRecipientSearchQuery(val);
        setFormData(prev => ({ ...prev, recipientName: val }));
        setShowRecipientResults(val.length >= 2);
    };

    const selectRecipientCustomer = (c: Customer) => {
        setFormData(prev => ({
            ...prev,
            recipientName: c.fullName,
            recipientPhone: c.phone
        }));
        setShowRecipientResults(false);
        toast.success("Recipient selected");
    };

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
            senderCurrency: 'USD',
            receiverCurrency: 'CAD',
            exchangeRate: '1.0000',
            fees: '0',
            notes: '',
            idType: 'passport',
            idNumber: '',
            allowPartialPayment: false,
        });
        toast.success("Form reset");
    };

    const handleConfirm = async () => {
        // Basic Validation matching old form
        if (!formData.senderName || !formData.senderPhone ||
            !formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error("Please fill in all required fields (Sender Name, Phone, Amount)");
            return;
        }

        // Recipient checks
        if ((formData.transactionType === 'CASH_EXCHANGE' || formData.transactionType === 'BANK_TRANSFER') && !formData.recipientName) {
            toast.error('Please enter recipient name');
            return;
        }

        setShowPreview(true);
    };

    const handleFinalSubmit = async () => {
        try {
            // Find/Create Customer
            if (formData.senderPhone && formData.senderName) {
                await findOrCreateMutation.mutateAsync({
                    phone: formData.senderPhone,
                    fullName: formData.senderName,
                });
            }
            if (formData.recipientPhone && formData.recipientName && formData.recipientPhone.length >= 10) {
                await findOrCreateMutation.mutateAsync({
                    phone: formData.recipientPhone,
                    fullName: formData.recipientName,
                });
            }

            let senderBranchId = user?.primaryBranchId;
            if (!senderBranchId && branches && branches.length > 0) senderBranchId = branches[0].id;

            if (!senderBranchId) {
                toast.error('No branches available.');
                return;
            }

            // Logic for receiver branch
            let receiverBranchId: number;
            if (['CASH_PICKUP', 'CARD_SWAP_IRR', 'INCOMING_FUNDS'].includes(formData.transactionType)) {
                receiverBranchId = senderBranchId;
            } else {
                receiverBranchId = parseInt(formData.receiverBranchId);
                if (!receiverBranchId || isNaN(receiverBranchId)) {
                    toast.error('Please select a receiving branch');
                    return;
                }
            }

            const senderAmount = parseFloat(formData.amount);
            const rate = parseFloat(formData.exchangeRate);
            const receiverAmount = getCalculatedRecv();

            // Append ID info to notes if Card Swap
            let finalNotes = formData.notes || '';
            if (formData.transactionType === 'CARD_SWAP_IRR') {
                finalNotes += ` [ID: ${formData.idType} - ${formData.idNumber}]`;
            }

            const response = await createPickupMutation.mutateAsync({
                senderName: formData.senderName,
                senderPhone: formData.senderPhone,
                senderBranchId: senderBranchId,
                recipientName: formData.recipientName || formData.senderName,
                recipientPhone: formData.recipientPhone || undefined,
                recipientIban: formData.recipientIban || undefined,
                transactionType: formData.transactionType,
                receiverBranchId: receiverBranchId,
                amount: senderAmount,
                currency: formData.senderCurrency,
                receiverCurrency: formData.receiverCurrency,
                exchangeRate: rate,
                receiverAmount: receiverAmount,
                fees: parseFloat(formData.fees || "0"),
                notes: finalNotes.trim() || undefined,
                allowPartialPayment: formData.allowPartialPayment,
            });

            if (formData.senderCurrency && formData.receiverCurrency && formData.exchangeRate) {
                saveRateToHistory(formData.senderCurrency, formData.receiverCurrency, formData.exchangeRate);
            }

            setGeneratedCode(response.pickupCode);
            setShowPreview(false);
            toast.success("Transfer Initiated Successfully");
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to initiate transfer"));
        }
    };

    if (generatedCode) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Transfer Successful</h2>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pickup Code</p>
                        <p className="text-4xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">{generatedCode}</p>
                    </div>
                    <button
                        onClick={() => setGeneratedCode(null)}
                        className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 transition"
                    >
                        Start New Transfer
                    </button>
                </div>
            </div>
        );
    }

    // Shared styling for form inputs/dropdowns
    const inputClasses = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-sm text-slate-700 dark:text-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors";
    const searchInputClasses = "block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-sm dark:text-white transition-colors";

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-sans transition-colors duration-200">
            {/* HEADER */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Initiate Transfer</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Create a new remittance or exchange</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            System Online
                        </span>
                    </div>
                </div>
            </header>

            {/* MAIN */}
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT: PRIMARY WORKFLOW */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* Exchange Details */}
                        <section ref={exchangeDetailsRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Coins className="w-4 h-4 text-slate-400" />
                                    Exchange Details
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={clearForm}
                                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-600 hover:text-indigo-600 transition"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* You Send */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">You Send</label>
                                    <div className="flex rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-1 dark:focus-within:ring-offset-slate-900 transition-all">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={handleNumberInput(formData.amount)}
                                            onChange={(e) => setFormData({ ...formData, amount: parseFormattedNumber(e.target.value) })}
                                            className="block w-full border-0 bg-transparent py-4 pl-4 text-2xl font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 focus:ring-0 tabular-nums outline-none"
                                            placeholder="0.00"
                                        />
                                        <div className="flex items-center border-l border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 px-3 rounded-r-xl">
                                            <Select
                                                value={formData.senderCurrency}
                                                onValueChange={(value) => setFormData({ ...formData, senderCurrency: value })}
                                            >
                                                <SelectTrigger className="h-12 border-0 bg-transparent px-0 py-0 text-base font-semibold text-slate-700 dark:text-slate-200 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0">
                                                    {renderCurrencySelectValue(formData.senderCurrency)}
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CURRENCIES.map((currency) => (
                                                        <SelectItem key={currency} value={currency} className="py-1.5 text-sm">
                                                            {renderCurrencySelectValueSmall(currency)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Swap / Pills */}
                                <div className="relative flex items-center justify-center -my-3 z-10">
                                    <div className="bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <button
                                            onClick={handleSwap}
                                            className="bg-slate-50 dark:bg-slate-800 p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Swap currencies"
                                        >
                                            <ArrowDownUp className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Recipient Gets */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Recipient Gets</label>
                                    <div className="flex rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-1 dark:focus-within:ring-offset-slate-900 transition-all bg-slate-50 dark:bg-slate-800/50">
                                        <input
                                            type="text"
                                            readOnly
                                            value={formatCurrency(getCalculatedRecv())}
                                            className="block w-full border-0 bg-transparent py-4 pl-4 text-2xl font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 focus:ring-0 tabular-nums outline-none"
                                        />
                                        <div className="flex items-center border-l border-slate-200 dark:border-slate-700 px-3 rounded-r-xl">
                                            <Select
                                                value={formData.receiverCurrency}
                                                onValueChange={(value) => setFormData({ ...formData, receiverCurrency: value })}
                                            >
                                                <SelectTrigger className="h-12 border-0 bg-transparent px-0 py-0 text-base font-semibold text-slate-700 dark:text-slate-200 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0">
                                                    {renderCurrencySelectValue(formData.receiverCurrency)}
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CURRENCIES.map((currency) => (
                                                        <SelectItem key={currency} value={currency} className="py-1.5 text-sm">
                                                            {renderCurrencySelectValueSmall(currency)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Small fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Exchange Rate</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={handleNumberInput(formData.exchangeRate)}
                                            onChange={(e) => setFormData({ ...formData, exchangeRate: parseFormattedNumber(e.target.value) })}
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Fees</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={handleNumberInput(formData.fees)}
                                            onChange={(e) => setFormData({ ...formData, fees: parseFormattedNumber(e.target.value) })}
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Internal Note</label>
                                        <input
                                            type="text"
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Optional..."
                                            className={inputClasses}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Customer Information (Restored Full Fields) */}
                        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    Customer & Transaction Information
                                </h2>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Transaction Type */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Transaction Type</label>
                                    <select
                                        value={formData.transactionType}
                                        onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as TransactionType })}
                                        className={inputClasses}
                                    >
                                        <option value="CASH_PICKUP">💱 Walk-In Exchange</option>
                                        <option value="CARD_SWAP_IRR">💳 Card Cash-Out (Iran)</option>
                                        <option value="INCOMING_FUNDS">💵 Receive Money</option>
                                        <option value="CASH_EXCHANGE">📤 Send to Branch</option>
                                        <option value="BANK_TRANSFER">🏦 Bank Transfer (Iran)</option>
                                    </select>
                                </div>

                                {['CASH_EXCHANGE', 'BANK_TRANSFER'].includes(formData.transactionType) && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Receiving Branch</label>
                                        <select
                                            value={formData.receiverBranchId}
                                            onChange={(e) => setFormData({ ...formData, receiverBranchId: e.target.value })}
                                            className={inputClasses}
                                        >
                                            <option value="">Select Branch...</option>
                                            {branches?.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Sender Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                                    <div className="relative" ref={senderSearchRef}>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Sender Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.senderName}
                                                onChange={(e) => handleSenderSearch(e.target.value)}
                                                onFocus={() => setShowSenderResults(formData.senderName.length >= 2)}
                                                className={searchInputClasses}
                                                placeholder="Search sender..."
                                            />
                                            {showSenderResults && senderSearchResults && (
                                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                    {senderSearchResults.map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => selectSenderCustomer(c)}
                                                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between border-b border-slate-100 dark:border-slate-700 last:border-0"
                                                        >
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">{c.fullName}</span>
                                                            <span className="text-xs text-slate-400">{c.phone}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Sender Phone</label>
                                        <input
                                            type="text"
                                            value={formData.senderPhone}
                                            onChange={(e) => handleSenderPhoneSearch(e.target.value)}
                                            className={inputClasses}
                                            placeholder="e.g., +1 416 555 0123"
                                        />
                                    </div>
                                </div>

                                {/* ID Verification (Card Swap) */}
                                {formData.transactionType === 'CARD_SWAP_IRR' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                        <div>
                                            <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1.5">ID Type</label>
                                            <select
                                                value={formData.idType}
                                                onChange={(e) => setFormData({ ...formData, idType: e.target.value as IdType })}
                                                className={inputClasses}
                                            >
                                                <option value="passport">Passport</option>
                                                <option value="national_id">National ID</option>
                                                <option value="drivers_license">Driver License</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1.5">ID Number</label>
                                            <input
                                                type="text"
                                                value={formData.idNumber}
                                                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                                                className={inputClasses}
                                                placeholder="ID Number..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Recipient Details */}
                                {(formData.transactionType !== 'CASH_PICKUP' && formData.transactionType !== 'CARD_SWAP_IRR') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                                        <div className="relative" ref={recipientSearchRef}>
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Recipient Name</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Search className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.recipientName}
                                                    onChange={(e) => handleRecipientSearch(e.target.value)}
                                                    onFocus={() => setShowRecipientResults(formData.recipientName.length >= 2)}
                                                    className={searchInputClasses}
                                                    placeholder="Search recipient..."
                                                />
                                                {showRecipientResults && recipientSearchResults && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                        {recipientSearchResults.map(c => (
                                                            <div
                                                                key={c.id}
                                                                onClick={() => selectRecipientCustomer(c)}
                                                                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between border-b border-slate-100 dark:border-slate-700 last:border-0"
                                                            >
                                                                <span className="font-medium text-slate-700 dark:text-slate-200">{c.fullName}</span>
                                                                <span className="text-xs text-slate-400">{c.phone}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Recipient Phone</label>
                                            <input
                                                type="text"
                                                value={formData.recipientPhone}
                                                onChange={(e) => setFormData({ ...formData, recipientPhone: formatPhoneNumber(e.target.value) })}
                                                className={inputClasses}
                                                placeholder="+1..."
                                            />
                                        </div>

                                        {formData.transactionType === 'BANK_TRANSFER' && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Recipient IBAN (Iran)</label>
                                                <input
                                                    type="text"
                                                    value={formData.recipientIban}
                                                    onChange={(e) => setFormData({ ...formData, recipientIban: e.target.value.toUpperCase() })}
                                                    className={`${inputClasses} font-mono`}
                                                    placeholder="IR..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Multi-payment Checkbox */}
                                <div className="flex items-start gap-3 pt-2">
                                    <input
                                        type="checkbox"
                                        id="allowPartialPayment"
                                        checked={formData.allowPartialPayment}
                                        onChange={(e) => setFormData({ ...formData, allowPartialPayment: e.target.checked })}
                                        className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600"
                                    />
                                    <div>
                                        <label htmlFor="allowPartialPayment" className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Enable Multi-Payment Mode
                                        </label>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                            Allow paying this transaction in multiple installments or currencies later.
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </section>
                    </div>

                    {/* RIGHT: STICKY TOOLS */}
                    <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">

                        {/* Available Funds */}
                        <section
                            style={availableFundsHeight ? { height: `${availableFundsHeight}px` } : undefined}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col"
                        >
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Available Funds</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">Live</span>
                                    <button
                                        onClick={handleRefreshLiveRates}
                                        disabled={refreshScrapedRates.isPending || isFetchingScrapedRates}
                                        className="text-slate-400 hover:text-indigo-600 transition-colors disabled:cursor-not-allowed disabled:text-slate-300"
                                        title="Refresh live rates"
                                    >
                                        <RefreshCw
                                            className={`w-3.5 h-3.5 ${refreshScrapedRates.isPending || isFetchingScrapedRates ? 'animate-spin' : ''}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        value={fundsFilter}
                                        onChange={(e) => setFundsFilter(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-xs font-medium text-slate-700 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-600/50 focus:border-indigo-600 outline-none"
                                        placeholder="Filter currency..."
                                    />
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
                                {AVAILABLE_FUNDS_CURRENCIES
                                    .filter((currency) => currency.includes(fundsFilter.toUpperCase()))
                                    .map((curr) => (
                                        <div
                                            key={curr}
                                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                                        >
                                            <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                                {renderCurrencyBadge(curr)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-slate-800 dark:text-white font-mono tabular-nums truncate">
                                                    {formatCurrency(balances[curr] ?? 0)}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium truncate">{curr}</div>
                                            </div>
                                            {liveRates && (
                                                <div className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap text-right">
                                                    {liveRates[curr] ?? 'Rate unavailable'}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </section>

                        {/* Summary */}
                        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-2xl shadow-sm dark:shadow-lg dark:shadow-slate-900/10 p-5 text-slate-800 dark:text-white relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100/70 dark:bg-indigo-600 dark:opacity-20 blur-3xl rounded-full pointer-events-none"></div>

                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <Receipt className="w-4 h-4" /> Summary
                            </h3>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Send Amount</span>
                                    <span className="font-numbers tabular-nums text-slate-900 dark:text-white">{formatCurrency(parseFloat(formData.amount || "0"))} {formData.senderCurrency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Rate</span>
                                    <span className="font-numbers tabular-nums text-emerald-600 dark:text-emerald-400">{formData.exchangeRate}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Total Fee</span>
                                    <span className="font-numbers tabular-nums text-slate-700 dark:text-slate-300">{formData.fees} {formData.receiverCurrency}</span>
                                </div>

                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

                                <div className="flex justify-between items-end">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">Total to Pay</span>
                                    <div className="text-right">
                                        <div className="flex items-baseline justify-end gap-2">
                                            <span className="text-xl font-bold font-numbers tabular-nums tracking-tight text-slate-900 dark:text-white">
                                                {formatCurrency(getCalculatedTotal())}
                                            </span>
                                            <span className="text-xl text-slate-700 dark:text-slate-300 font-semibold">
                                                {formData.receiverCurrency}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleConfirm}
                                disabled={createPickupMutation.isPending}
                                className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus:ring-white/20"
                            >
                                {createPickupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                    <>
                                        <span>Confirm Transfer</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </section>

                    </aside>
                </div>
            </main>

            <TransactionPreviewDialog
                open={showPreview}
                onOpenChange={setShowPreview}
                onConfirm={handleFinalSubmit}
                isSubmitting={createPickupMutation.isPending}
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
                    receiverAmount: getCalculatedRecv(),
                    fees: formData.fees,
                    notes: formData.notes,
                    senderBranch: branches?.find((branch) => branch.id === user?.primaryBranchId)?.name,
                    receiverBranch: branches?.find((branch) => branch.id === parseInt(formData.receiverBranchId || user?.primaryBranchId?.toString() || "0"))?.name,
                    allowPartialPayment: formData.allowPartialPayment,
                }}
            />
        </div>
    );
}
