import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Inter } from "next/font/google";
import { locales, defaultLocale, Locale } from '@/i18n/config';
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// BCP 47 格式: 简体 zh, 繁体 zh-TW, 英文 en
const localeToHtmlLang: Record<Locale, string> = {
  'zh': 'zh-CN',
  'zh-TW': 'zh-TW',
  'en': 'en'
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 验证语言是否有效：无效 locale 重定向到默认 locale 而不是直接 404
  if (!locales.includes(locale as Locale)) {
    redirect(`/${defaultLocale}`);
  }

  // 获取翻译消息
  const messages = await getMessages();
  const htmlLang = localeToHtmlLang[locale as Locale] || 'en';

  return (
    <html lang={htmlLang}>
      <body className={`${inter.variable} antialiased font-sans`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
