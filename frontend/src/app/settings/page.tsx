import { Suspense } from 'react';
import { PageSheet } from '@/components/PageSheet';
import { SettingsView } from '@/components/settings/SettingsView';
import type { Metadata } from 'next';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.menu.settings };

export default function SettingsPage() {
  return (
    <PageSheet back={{ href: '/', label: t.menu.home }} title={t.menu.settings} width="sm">
      <Suspense fallback={<p className="text-ink-3">{t.common.loading}</p>}>
        <SettingsView />
      </Suspense>
    </PageSheet>
  );
}
