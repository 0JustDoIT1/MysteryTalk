import { NoticeList } from '@/components/NoticeList';
import { PageSheet } from '@/components/PageSheet';
import type { Metadata } from 'next';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.menu.notices };

export default function NoticesPage() {
  return (
    <PageSheet back={{ href: '/', label: t.menu.home }} title={t.menu.notices} width="md">
      <NoticeList />
    </PageSheet>
  );
}
