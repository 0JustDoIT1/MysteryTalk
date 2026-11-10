import type { Metadata } from 'next';
import { Toasts } from '@/components/Toasts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MysteryTalk',
  description: '질문으로 진실을 찾는 픽셀아트 추리 게임',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
          <Toasts />
        </Providers>
      </body>
    </html>
  );
}
