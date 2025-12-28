'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/src/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { Languages } from 'lucide-react';

export function LanguageToggle() {
    const { i18n } = useTranslation();

    useEffect(() => {
        // Set document direction based on language
        document.documentElement.dir = i18n.language === 'fa' ? 'rtl' : 'ltr';
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Languages className="h-4 w-4" />
                    <span className="hidden sm:inline">
                        {i18n.language === 'fa' ? 'فارسی' : 'English'}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                    English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('fa')}>
                    فارسی (Persian)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
