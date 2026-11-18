'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GENRES_WITH_ALL, filterByGenre, type GenreFilter } from '@/lib/play/cases';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { CaseArt } from './CaseArt';

/** 사건 선택(SPEC §12): 장르 필터는 URL 상태(?genre=), 카드는 서버 상태. 카드는 그림·번호·제목·상태만(PRD D98). */
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
        <h1 id="cases-heading" className="text-xl font-semibold">
          {t.cases.heading}
        </h1>
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
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cases.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/cases/${c.slug}`}
              className="flex h-full flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900 p-2 hover:border-amber-300/60"
            >
              <CaseArt caseNo={c.caseNo} isTutorial={c.isTutorial} genre={c.genres[0]} />
              <div className="flex flex-col gap-1 px-1 pb-1">
                <p className="font-mono text-xs text-stone-400">
                  {c.isTutorial
                    ? t.cases.tutorialBadge
                    : c.caseNo > 0
                      ? t.cases.caseNo(c.caseNo)
                      : t.cases.sample}
                </p>
                <h2 className="font-semibold text-amber-100">{c.title}</h2>
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="rounded bg-stone-800 px-1.5 py-0.5">
                    {t.difficulty[c.difficulty]}
                  </span>
                  <span className="rounded bg-stone-800 px-1.5 py-0.5">{t.rating[c.rating]}</span>
                  {c.activeSessionId && (
                    <span className="rounded bg-amber-900 px-1.5 py-0.5 text-amber-200">
                      {t.cases.inProgress}
                    </span>
                  )}
                </div>
                {!c.isTutorial && (
                  <p className="text-xs text-stone-400">
                    {c.record?.solved ? `✔ ${t.cases.solved}` : t.cases.unsolved}
                    {c.record && ` · ${t.cases.bestShort(c.record.bestGrade)}`}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
