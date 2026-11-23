'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GENRES_WITH_ALL, filterByGenre, type GenreFilter, caseLabel } from '@/lib/play/cases';
import { useCases } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { CaseArt } from './CaseArt';
import { DifficultyDots } from './DifficultyDots';

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
        <div role="group" aria-label={t.cases.genreLabel} className="flex gap-1">
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
              <div className="relative">
                <CaseArt
                  slug={c.slug}
                  caseNo={c.caseNo}
                  isTutorial={c.isTutorial}
                  genre={c.genres[0]}
                  coverVersion={c.coverVersion}
                />
                {/* 사진 왼쪽 위: 장르 배지 */}
                <span className="absolute top-1.5 left-1.5 rounded-sm bg-desk/80 px-1.5 py-0.5 text-[11px] font-semibold text-cream">
                  {c.genres.map((g) => t.genre[g]).join('·')}
                </span>
                {/* 사진 오른쪽 위: 해결·미해결 스티커(튜토리얼은 기록하지 않아 없음) */}
                {!c.isTutorial && (
                  <span
                    className={`absolute -top-2 -right-2 rounded-sm border-2 px-1.5 py-0.5 font-serif text-xs font-bold shadow-md ${
                      c.record?.solved
                        ? 'rotate-6 border-stamp bg-paper text-stamp'
                        : 'rotate-[-4deg] border-line-strong bg-paper-2 text-ink-3'
                    }`}
                  >
                    {c.record?.solved ? t.cases.solved : t.cases.unsolved}
                    {c.record && ` · ${t.cases.bestShort(c.record.bestGrade)}`}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 px-1 pb-1">
                {caseLabel(c) && <p className="text-xs font-semibold text-ink-3">{caseLabel(c)}</p>}
                <h2 className="font-bold text-ink">{c.title}</h2>
                <div className="flex flex-wrap items-center gap-1">
                  <DifficultyDots difficulty={c.difficulty} />
                  {/* 수위는 '강함'일 때만 알린다(보통은 표시하지 않음) */}
                  {c.rating === 'STRONG' && (
                    <span className="chip border-stamp bg-bad-bg font-semibold text-stamp">
                      {t.rating.STRONG}
                    </span>
                  )}
                  {c.activeSessionId && (
                    <span className="chip border-gold bg-warn-bg text-warn">
                      {t.cases.inProgress}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
