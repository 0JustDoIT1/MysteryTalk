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

  if (isPending) return <p className="text-ink-3">{t.common.loading}</p>;
  if (error)
    return (
      <p role="alert" className="text-bad">
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
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink/70 pb-2">
        <h1 id="cases-heading" className="text-2xl font-bold">
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
              className={`rounded-sm px-3 py-1 font-serif text-sm font-bold ${genre === g ? 'bg-accent text-cream' : 'border border-line bg-paper-2 text-ink-2 hover:bg-paper-3'}`}
            >
              {t.genre[g]}
            </button>
          ))}
        </div>
      </div>
      {firstVisit && (
        <p className="paper-inset border-l-4 border-l-stamp px-3 py-2 text-sm text-ink-2">
          {t.cases.tutorialHint}
        </p>
      )}
      {cases.length === 0 && <p className="text-ink-3">{t.cases.empty}</p>}
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cases.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/cases/${c.slug}`}
              className="photo flex h-full flex-col gap-2 transition-transform hover:-translate-y-0.5 hover:outline-2 hover:outline-gold"
            >
              <CaseArt
                slug={c.slug}
                caseNo={c.caseNo}
                isTutorial={c.isTutorial}
                genre={c.genres[0]}
                coverVersion={c.coverVersion}
              />
              <div className="flex flex-col gap-1 px-1 pb-1">
                <p className="font-mono text-xs tracking-wider text-ink-3">
                  {c.isTutorial
                    ? t.cases.tutorialBadge
                    : c.caseNo > 0
                      ? t.cases.caseNo(c.caseNo)
                      : t.cases.sample}
                </p>
                <h2 className="font-bold text-ink">{c.title}</h2>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="chip">{t.difficulty[c.difficulty]}</span>
                  <span className="chip">{t.rating[c.rating]}</span>
                  {c.activeSessionId && (
                    <span className="chip border-gold bg-warn-bg text-warn">
                      {t.cases.inProgress}
                    </span>
                  )}
                </div>
                {!c.isTutorial && (
                  <p
                    className={`text-xs ${c.record?.solved ? 'font-bold text-stamp' : 'text-ink-3'}`}
                  >
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
