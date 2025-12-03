'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'en' | 'fa';

interface TranslationContextType {
    locale: Locale;
    t: (key: string) => string;
    setLocale: (locale: Locale) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [translations, setTranslations] = useState<any>({});

    useEffect(() => {
        // Load locale from localStorage
        const savedLocale = (localStorage.getItem('locale') || 'en') as Locale;
        setLocaleState(savedLocale);
        loadTranslations(savedLocale);
    }, []);

    const loadTranslations = async (loc: Locale) => {
        try {
            const response = await import(`@/locales/${loc}/common.json`);
            setTranslations(response.default);
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    };

    const setLocale = (newLocale: Locale) => {
        localStorage.setItem('locale', newLocale);
        setLocaleState(newLocale);
        loadTranslations(newLocale);

        // Apply RTL
        if (newLocale === 'fa') {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
        } else {
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
        }
    };

    const t = (key: string): string => {
        const keys = key.split('.');
        let value: any = translations;

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        return typeof value === 'string' ? value : key;
    };

    return (
        <TranslationContext.Provider value={{ locale, t, setLocale }}>
            {children}
        </TranslationContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslation must be used within TranslationProvider');
    }
    return context;
}
