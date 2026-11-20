'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCaseDetail, useCases, useStartSession } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { CaseArt } from './CaseArt';
import { CaseMeta } from './CaseMeta';
import { caseLabel } from '@/lib/play/cases';

/** 사건 소개(PRD D98·D99): 그림·번호·제목, 사건 정보, 수위·태그·기록, 한 줄 요약, 도입, 시작/이어서(D54) */
export function CaseIntro() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const detail = useCaseDetail(slug);
  const cases = useCases();
  const start = useStartSession(slug);
  useDocumentTitle(detail.data?.title);
  const summary = cases.data?.find((c) => c.slug === slug);
  const activeSessionId = summary?.activeSessionId ?? null;
  const record = summary?.record ?? null;

  if (detail.isPending) return <p className="text-cream-2">{t.common.loading}</p>;
  if (detail.error)
    return (
      <p role="alert" className="paper p-4 text-bad">
        {detail.error.message}{' '}
        <Link href="/cases" className="link">
          {t.common.back}
        </Link>
      </p>
    );
  const c = detail.data;

  return (
    <>
      <Link href="/cases" className="back-link w-fit">
        ← {t.common.back}
      </Link>
      <article className="paper relative flex min-w-0 flex-col gap-6 p-5 sm:p-8">
        <header className="flex flex-col gap-1 border-b-2 border-ink/70 pb-3">
          <p className="text-xs font-semibold text-ink-3">
            {t.intro.report}
            {caseLabel(c) && ` · ${caseLabel(c)}`}
          </p>
          <h1 className="text-3xl font-bold text-ink">{c.title}</h1>
        </header>
        {record?.solved && (
          <span aria-hidden="true" className="stamp absolute top-6 right-6 text-lg">
            {t.cases.solved}
          </span>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="photo relative -rotate-1 self-start">
            <span
              aria-hidden="true"
              className="absolute -top-3 left-6 h-8 w-3 rounded-full border-2 border-ink-3/70"
            />
            <CaseArt
              slug={c.slug}
              caseNo={c.caseNo}
              isTutorial={c.isTutorial}
              genre={c.genres[0]}
              coverVersion={c.coverVersion}
            />
          </div>
          <div className="flex flex-col gap-3">
            <span className="tag">{t.intro.overview}</span>
            <p className="text-ink">{c.summary}</p>
            <CaseMeta
              genres={c.genres}
              difficulty={c.difficulty}
              baseQuestions={c.baseQuestions}
              maxQuestions={c.maxQuestions}
              elementCount={c.elementCount}
            />
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              {c.rating === 'STRONG' && (
                <span className="chip border-stamp bg-bad-bg font-semibold text-stamp">
                  {t.rating.STRONG}
                </span>
              )}
              {c.tags.map((tag) => `#${tag}`).join(' ')}
            </p>
            {record && (
              <p className="text-xs text-ink-2">
                {record.solved ? `✔ ${t.cases.solved}` : t.cases.unsolved} ·{' '}
                {t.cases.best(record.bestGrade, record.bestPlayNo, record.totalPlays)}
              </p>
            )}
          </div>
        </div>
        <section aria-labelledby="intro-heading" className="flex flex-col gap-2">
          <h2 id="intro-heading" className="label">
            {t.intro.heading}
          </h2>
          <p className="whitespace-pre-line leading-relaxed text-ink-2">{c.intro}</p>
        </section>
        <div className="flex gap-3 border-t border-dashed border-line pt-4">
          {activeSessionId ? (
            <Link href={`/play/${activeSessionId}`} className="btn btn-primary px-6">
              {t.intro.resume}
            </Link>
          ) : (
            <button
              type="button"
              disabled={start.isPending || cases.isPending}
              onClick={() =>
                start.mutate(undefined, {
                  onSuccess: ({ sessionId }) => router.push(`/play/${sessionId}`),
                })
              }
              className="btn btn-primary px-6"
            >
              {start.isPending ? t.intro.starting : t.intro.start}
            </button>
          )}
        </div>
        {start.error && (
          <p role="alert" className="text-sm text-bad">
            {start.error.message}
          </p>
        )}
      </article>
    </>
  );
}
