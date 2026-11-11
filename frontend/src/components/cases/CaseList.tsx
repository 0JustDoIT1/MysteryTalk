'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GENRES_WITH_ALL, filterByGenre, type GenreFilter } from '@/lib/play/cases';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 사건 선택(SPEC §12): 장르 필터는 URL 상태(?genre=), 카드는 서버 상태. */
export function CaseList() {
  const router = useRouter();
  const params = useSearchParams();
  const genre = (GENRES_WITH_ALL as readonly string[]).includes(params.get('genre') ?? '')
    ? (params.get('genre') as GenreFilter)
    : 'ALL';
  const { data, error, isPending, refetch } = useCases();

  if (isPending) return <p className="text-stone-400">{t.common.loading}</p>;
  if (error)
    return (
      <p role="alert" className="text-red-300">
        {t.common.loadFailed}{' '}
        <button type="button" className="underline" onClick={() => void refetch()}>
          {t.common.retry}
        </button>
      </p>
    );

  const cases = filterByGenre(data, genre);
  const firstVisit = data.every((c) => !c.record && !c.activeSessionId);

  return (
    <section aria-labelledby="cases-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cases-heading" className="text-xl font-semibold">
          {t.cases.heading}
        </h2>
        <div role="group" aria-label="장르" className="flex gap-1">
          {GENRES_WITH_ALL.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={genre === g}
              onClick={() =>
                router.replace(g === 'ALL' ? '/cases' : `/cases?genre=${g}`, { scroll: false })
              }
              className={`rounded px-3 py-1 text-sm ${genre === g ? 'bg-amber-300 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
            >
              {t.genre[g]}
            </button>
          ))}
        </div>
      </div>
      {firstVisit && <p className="text-sm text-amber-200/80">{t.cases.tutorialHint}</p>}
      {cases.length === 0 && <p className="text-stone-400">{t.cases.empty}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {cases.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/cases/${c.slug}`}
              className="flex h-full flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900 p-4 hover:border-amber-300/60"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {c.isTutorial && (
                  <span className="rounded bg-sky-900 px-2 py-0.5 text-sky-200">
                    {t.cases.tutorialBadge}
                  </span>
                )}
                <span className="rounded bg-stone-800 px-2 py-0.5">
                  {t.difficulty[c.difficulty]}
                </span>
                <span className="rounded bg-stone-800 px-2 py-0.5">{t.rating[c.rating]}</span>
                {c.activeSessionId && (
                  <span className="rounded bg-amber-900 px-2 py-0.5 text-amber-200">
                    {t.cases.inProgress}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-amber-100">{c.title}</h3>
              <p className="text-sm text-stone-300">{c.summary}</p>
              <p className="text-xs text-stone-400">{c.tags.map((tag) => `#${tag}`).join(' ')}</p>
              {!c.isTutorial && (
                <p className="mt-auto text-xs text-stone-400">
                  {c.record?.solved ? `✔ ${t.cases.solved}` : t.cases.unsolved}
                  {c.record &&
                    ` · ${t.cases.best(c.record.bestGrade, c.record.bestPlayNo, c.record.totalPlays)}`}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
