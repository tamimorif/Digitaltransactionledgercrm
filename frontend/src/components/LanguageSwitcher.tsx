'use client';

import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { Button } from '@/src/components/ui/button';
import { useState, useEffect } from 'react';

const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
];

export function LanguageSwitcher() {
    const router = useRouter();
    const [locale, setLocale] = useState<string>('en');

    useEffect(() => {
        // Get locale from localStorage or default to 'en'
        const savedLocale = localStorage.getItem('locale') || 'en';
        setLocale(savedLocale);

        // Apply RTL if Persian
        if (savedLocale === 'fa') {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
        } else {
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
        }
    }, []);

    const handleLanguageChange = (newLocale: string) => {
        // Save to localStorage
        localStorage.setItem('locale', newLocale);
        setLocale(newLocale);

        // Apply RTL/LTR
        if (newLocale === 'fa') {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
        } else {
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
        }

        // Reload page to apply translations
        router.refresh();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Change Language">
                    <Globe className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={locale === lang.code ? 'bg-accent' : ''}
                    >
                        <span className="mr-2 text-lg">{lang.flag}</span>
                        <span className="flex-1">{lang.nativeName}</span>
                        {locale === lang.code && <span className="ml-2 text-xs">✓</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
