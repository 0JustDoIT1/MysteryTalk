import { Suspense } from 'react';
import { AccountBar } from '@/components/account/AccountBar';
import { MainMenu } from '@/components/MainMenu';
import { DeletedNotice } from '@/components/settings/DeletedNotice';
import { t } from '@/i18n/ko';

/** 메인(SPEC §12): 수사 파일 표지처럼 제목 아래 계정 상태·메뉴를 한 장의 서류에 담는다. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-cream drop-shadow-[0_2px_0_rgb(0_0_0/0.5)]">
          {t.app.title}
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
