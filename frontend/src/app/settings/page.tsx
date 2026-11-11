import Link from 'next/link';
import { Suspense } from 'react';
import { SettingsView } from '@/components/settings/SettingsView';
import { t } from '@/i18n/ko';

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← {t.menu.home}
      </Link>
      <h1 className="text-xl font-semibold">{t.menu.settings}</h1>
      <Suspense fallback={<p className="text-stone-400">{t.common.loading}</p>}>
        <SettingsView />
      </Suspense>
    </main>
  );
}
