import type { Metadata } from 'next';
import { AgeGate } from '@/components/account/AgeGate';
import { DetectiveSetup } from '@/components/account/DetectiveSetup';
import { BgmPlayer } from '@/components/BgmPlayer';
import { Toasts } from '@/components/Toasts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  // 화면마다 '사건 선택 · MysteryTalk'처럼 제목을 붙인다(PRD D66)
  title: { default: 'MysteryTalk', template: '%s · MysteryTalk' },
  description: '질문으로 진실을 찾는 픽셀아트 추리 게임',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <AgeGate>
            {children}
            <DetectiveSetup />
          </AgeGate>
          <Toasts />
          <BgmPlayer />
        </Providers>
      </body>
    </html>
  );
}
