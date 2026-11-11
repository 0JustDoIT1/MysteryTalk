import Link from 'next/link';
import { Suspense } from 'react';
import { CaseList } from '@/components/cases/CaseList';
import { t } from '@/i18n/ko';

export default function CasesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← {t.menu.home}
      </Link>
      <Suspense fallback={<p className="text-stone-400">{t.common.loading}</p>}>
        <CaseList />
      </Suspense>
    </main>
  );
}
