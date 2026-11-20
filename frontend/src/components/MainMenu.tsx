'use client';

import Link from 'next/link';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 메인 메뉴(PRD §2): 새 스토리 / 이어서 / 공지 / 설정. 서류철의 색인 칸처럼 보이게 한다. */
export function MainMenu() {
  const cases = useCases();
  const activeCount = cases.data?.filter((c) => c.activeSessionId).length ?? 0;
  const item =
    'group flex items-center justify-between gap-3 border-b border-dashed border-line px-2 py-3.5 font-serif text-lg font-bold text-ink hover:bg-paper-2';
  const arrow = (
    <span aria-hidden="true" className="text-ink-3 group-hover:text-stamp">
      ▸
    </span>
  );
  return (
    <nav aria-label={t.menu.label} className="flex flex-col">
      <Link href="/cases" className={item}>
        {t.menu.newStory}
        {arrow}
      </Link>
      <Link href="/continue" className={item}>
        <span className="flex items-center gap-2">
          {t.menu.continue}
          {activeCount > 0 && (
            <span className="chip border-gold bg-warn-bg font-sans text-warn">
              {t.menu.inProgress(activeCount)}
            </span>
          )}
        </span>
        {arrow}
      </Link>
      <Link href="/notices" className={item}>
        {t.menu.notices}
        {arrow}
      </Link>
      <Link href="/settings" className={`${item} border-b-0`}>
        {t.menu.settings}
        {arrow}
      </Link>
    </nav>
  );
}
