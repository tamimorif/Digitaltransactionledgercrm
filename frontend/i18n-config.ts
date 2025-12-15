export const i18n = {
    defaultLocale: 'en',
    locales: ['en', 'fa'],
} as const;

export type I18nConfig = typeof i18n;
export type Locale = (typeof i18n)['locales'][number];
