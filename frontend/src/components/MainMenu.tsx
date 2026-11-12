'use client';

import Link from 'next/link';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 메인 메뉴(PRD §2): 새 스토리 / 이어서 / 공지 / 설정. 공지·설정은 이후 단계에서 연결한다. */
export function MainMenu() {
  const cases = useCases();
  const activeCount = cases.data?.filter((c) => c.activeSessionId).length ?? 0;
  const item =
    'flex items-center justify-between rounded-lg border border-stone-700 bg-stone-900 px-5 py-4 text-lg';
  return (
    <nav aria-label={t.menu.label} className="flex flex-col gap-3">
      <Link href="/cases" className={`${item} hover:border-amber-300/60`}>
        {t.menu.newStory}
      </Link>
      <Link href="/continue" className={`${item} hover:border-amber-300/60`}>
        {t.menu.continue}
        {activeCount > 0 && (
          <span className="rounded bg-amber-900 px-2 py-0.5 text-sm text-amber-200">
            {t.menu.inProgress(activeCount)}
          </span>
        )}
      </Link>
      <Link href="/notices" className={`${item} hover:border-amber-300/60`}>
        {t.menu.notices}
      </Link>
      <Link href="/settings" className={`${item} hover:border-amber-300/60`}>
        {t.menu.settings}
      </Link>
    </nav>
  );
}
