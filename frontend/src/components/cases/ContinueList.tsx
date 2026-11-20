'use client';

import Link from 'next/link';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 이어서(PRD D54): 진행 중인 사건 목록. 사건당 진행 중 기록은 1개다. */
export function ContinueList() {
  const { data, isPending, error } = useCases();
  if (isPending) return <p className="text-ink-3">{t.common.loading}</p>;
  if (error)
    return (
      <p role="alert" className="text-bad">
        {error.message}
      </p>
    );
  const active = data.filter((c) => c.activeSessionId);
  if (!active.length)
    return (
      <p className="text-ink-3">
        {t.continue.empty}{' '}
        <Link href="/cases" className="link">
          {t.menu.newStory}
        </Link>
      </p>
    );
  return (
    <ul className="flex flex-col gap-2">
      {active.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/play/${c.activeSessionId}`}
            className="paper-inset flex items-center justify-between gap-3 border-l-4 border-l-accent p-4 hover:bg-paper-3"
          >
            <span>
              <span className="block font-serif font-bold text-ink">{c.title}</span>
              <span className="text-sm text-ink-3">{c.summary}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent">
              {t.continue.resume} →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
