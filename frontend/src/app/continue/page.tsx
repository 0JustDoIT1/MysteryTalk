import { ContinueList } from '@/components/cases/ContinueList';
import { PageSheet } from '@/components/PageSheet';
import type { Metadata } from 'next';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.menu.continue };

export default function ContinuePage() {
  return (
    <PageSheet back={{ href: '/', label: t.menu.home }} title={t.menu.continue}>
      <ContinueList />
    </PageSheet>
  );
}
