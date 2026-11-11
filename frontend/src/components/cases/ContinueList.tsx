'use client';

import Link from 'next/link';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 이어서(PRD D54): 진행 중인 사건 목록. 사건당 진행 중 기록은 1개다. */
export function ContinueList() {
  const { data, isPending, error } = useCases();
  if (isPending) return <p className="text-stone-400">{t.common.loading}</p>;
  if (error)
    return (
      <p role="alert" className="text-red-300">
        {error.message}
      </p>
    );
  const active = data.filter((c) => c.activeSessionId);
  if (!active.length)
    return (
      <p className="text-stone-400">
        {t.continue.empty}{' '}
        <Link href="/cases" className="text-amber-200 underline">
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
            className="flex items-center justify-between rounded-lg border border-stone-700 bg-stone-900 p-4 hover:border-amber-300/60"
          >
            <span>
              <span className="block font-semibold text-amber-100">{c.title}</span>
              <span className="text-sm text-stone-400">{c.summary}</span>
            </span>
            <span className="text-sm text-amber-200">{t.continue.resume} →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
