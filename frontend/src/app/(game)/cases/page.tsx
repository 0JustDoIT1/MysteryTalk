import { Suspense } from 'react';
import { CaseList } from '@/components/cases/CaseList';
import { PageSheet } from '@/components/PageSheet';
import type { Metadata } from 'next';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.cases.heading };

export default function CasesPage() {
  return (
    <PageSheet back={{ href: '/', label: t.menu.home }}>
      <Suspense fallback={<p className="text-ink-3">{t.common.loading}</p>}>
        <CaseList />
      </Suspense>
    </PageSheet>
  );
}
