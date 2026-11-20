import { Suspense } from 'react';
import { EndingView } from '@/components/play/EndingView';
import { t } from '@/i18n/ko';

export default function EndingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-8 sm:py-10">
      <Suspense fallback={<p className="text-ink-3">{t.common.loading}</p>}>
        <EndingView />
      </Suspense>
    </main>
  );
}
