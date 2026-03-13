export const locales = ['zh', 'zh-TW', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh';

// 语言显示名称
export const localeNames: Record<Locale, string> = {
  zh: '简体中文',
  'zh-TW': '繁體中文',
  en: 'English'
};
