import { Suspense } from 'react';
import { CaseIntro } from '@/components/cases/CaseIntro';
import { t } from '@/i18n/ko';

export default function CasePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-stone-400">{t.common.loading}</p>}>
        <CaseIntro />
      </Suspense>
    </main>
  );
}
