import Image from 'next/image';
import { Suspense } from 'react';
import logoFull from '../../../public/images/logo/logo-full.png';
import { AccountBar } from '@/components/account/AccountBar';
import { MainMenu } from '@/components/MainMenu';
import { DeletedNotice } from '@/components/settings/DeletedNotice';
import { t } from '@/i18n/ko';

/** 메인(SPEC §12): 수사 파일 표지처럼 제목 아래 계정 상태·메뉴를 한 장의 서류에 담는다. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1>
          {/* 조합 로고(엠블럼 + 간판). 대체 글이 곧 제목이라 화면 낭독기는 'MysteryTalk'로 읽는다 */}
          <Image
            src={logoFull}
            alt={t.app.title}
            priority
            sizes="(max-width: 640px) 90vw, 448px"
            className="h-auto w-full max-w-md"
          />
        </h1>
        <p className="text-sm text-cream-2">{t.app.tagline}</p>
      </header>
      <div className="paper relative flex flex-col gap-5 px-6 pt-8 pb-6">
        <span aria-hidden="true" className="stamp absolute -top-4 right-6 bg-paper text-sm">
          {t.app.stamp}
        </span>
        <Suspense fallback={null}>
          <AccountBar />
          <DeletedNotice />
        </Suspense>
        <MainMenu />
      </div>
    </main>
  );
}
