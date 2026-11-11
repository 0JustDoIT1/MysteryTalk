import { Suspense } from 'react';
import { AccountBar } from '@/components/account/AccountBar';
import { MainMenu } from '@/components/MainMenu';
import { t } from '@/i18n/ko';

/** 메인(SPEC §12): 배너·계정 상태·메뉴. 배너 그림은 아트 작업 단계에서 넣는다. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-amber-200">{t.app.title}</h1>
        <p className="mt-2 text-sm text-stone-400">{t.app.tagline}</p>
      </header>
      <Suspense fallback={null}>
        <AccountBar />
      </Suspense>
      <MainMenu />
    </main>
  );
}
