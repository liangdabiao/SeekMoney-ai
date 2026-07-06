// 根布局仅做占位，html 标签与字体注入移到 [locale]/layout.tsx
// 这样可以根据当前 locale 设置 lang 属性（无障碍 + SEO 必需）
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
