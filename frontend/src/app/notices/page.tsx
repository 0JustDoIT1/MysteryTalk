import Link from 'next/link';
import { NoticeList } from '@/components/NoticeList';
import { t } from '@/i18n/ko';

export default function NoticesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← {t.menu.home}
      </Link>
      <h1 className="text-xl font-semibold">{t.menu.notices}</h1>
      <NoticeList />
    </main>
  );
}
