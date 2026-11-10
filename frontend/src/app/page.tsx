import { Suspense } from 'react';
import { CaseList } from '@/components/cases/CaseList';
import { t } from '@/i18n/ko';

// 18세 확인·메인 메뉴(새 스토리/이어서/공지/설정)는 이후 단계에서 붙인다(SPEC §12).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-amber-200">{t.app.title}</h1>
        <p className="mt-1 text-sm text-stone-400">{t.app.tagline}</p>
      </header>
      <Suspense fallback={<p className="text-stone-400">{t.common.loading}</p>}>
        <CaseList />
      </Suspense>
    </main>
  );
}
