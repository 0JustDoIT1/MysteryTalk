import { Suspense } from 'react';
import { PlayScreen } from '@/components/play/PlayScreen';
import { t } from '@/i18n/ko';

export default function PlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-stone-400">{t.common.loading}</p>}>
        <PlayScreen />
      </Suspense>
    </main>
  );
}
