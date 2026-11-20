import type { Metadata } from 'next';
import { Noto_Serif_KR } from 'next/font/google';
import { AgeGate } from '@/components/account/AgeGate';
import { DetectiveSetup } from '@/components/account/DetectiveSetup';
import { BgmPlayer } from '@/components/BgmPlayer';
import { Toasts } from '@/components/Toasts';
import { Providers } from './providers';
import './globals.css';

// 제목용 명조체. next/font가 빌드 때 받아 우리 서버에서 제공한다(이용자 브라우저가 구글에 직접 요청하지 않음).
const serif = Noto_Serif_KR({
  weight: ['500', '700'],
  preload: false,
  display: 'swap',
  variable: '--font-serif-kr',
});

export const metadata: Metadata = {
  // 화면마다 '사건 선택 · MysteryTalk'처럼 제목을 붙인다(PRD D66)
  title: { default: 'MysteryTalk', template: '%s · MysteryTalk' },
  description: '질문으로 진실을 찾는 픽셀아트 추리 게임',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`h-full antialiased ${serif.variable}`}>
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
