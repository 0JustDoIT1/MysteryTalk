'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCaseDetail, useCases, useStartSession } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { CaseArt } from './CaseArt';
import { CaseMeta } from './CaseMeta';

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

  if (detail.isPending) return <p className="text-stone-400">{t.common.loading}</p>;
  if (detail.error)
    return (
      <p role="alert" className="text-red-300">
        {detail.error.message}{' '}
        <Link href="/cases" className="underline">
          {t.common.back}
        </Link>
      </p>
    );
  const c = detail.data;

  return (
    <article className="flex flex-col gap-6">
      <Link href="/cases" className="text-sm text-stone-400 hover:text-stone-200">
        ← {t.common.back}
      </Link>
      <div className="w-full max-w-xl">
        <CaseArt
          slug={c.slug}
          caseNo={c.caseNo}
          isTutorial={c.isTutorial}
          genre={c.genres[0]}
          coverVersion={c.coverVersion}
        />
      </div>
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs text-stone-400">
          {c.isTutorial
            ? t.cases.tutorialBadge
            : c.caseNo > 0
              ? t.cases.caseNo(c.caseNo)
              : t.cases.sample}
        </p>
        <h1 className="text-2xl font-bold text-amber-200">{c.title}</h1>
        <p className="text-stone-300">{c.summary}</p>
        <CaseMeta
          genres={c.genres}
          difficulty={c.difficulty}
          baseQuestions={c.baseQuestions}
          maxQuestions={c.maxQuestions}
          elementCount={c.elementCount}
        />
        <p className="text-xs text-stone-400">
          {t.rating[c.rating]} · {c.tags.map((tag) => `#${tag}`).join(' ')}
        </p>
        {record && (
          <p className="text-xs text-stone-400">
            {record.solved ? `✔ ${t.cases.solved}` : t.cases.unsolved} ·{' '}
            {t.cases.best(record.bestGrade, record.bestPlayNo, record.totalPlays)}
          </p>
        )}
      </header>
      <section aria-labelledby="intro-heading" className="flex flex-col gap-2">
        <h2 id="intro-heading" className="font-semibold text-amber-100">
          {t.intro.heading}
        </h2>
        <p className="whitespace-pre-line leading-relaxed text-stone-200">{c.intro}</p>
      </section>
      <div className="flex gap-3">
        {activeSessionId ? (
          <Link
            href={`/play/${activeSessionId}`}
            className="rounded bg-amber-300 px-5 py-2 font-semibold text-stone-900 hover:bg-amber-200"
          >
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
            className="rounded bg-amber-300 px-5 py-2 font-semibold text-stone-900 hover:bg-amber-200 disabled:opacity-50"
          >
            {start.isPending ? t.intro.starting : t.intro.start}
          </button>
        )}
      </div>
      {start.error && (
        <p role="alert" className="text-sm text-red-300">
          {start.error.message}
        </p>
      )}
    </article>
  );
}
