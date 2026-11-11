'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCaseDetail, useCases, useStartSession } from '@/lib/api/queries';
import { CaseFileView } from '@/components/play/CaseFileView';
import { t } from '@/i18n/ko';

/** 도입 이야기 + 수사 자료 + 시작/이어서(PRD D77, D54) */
export function CaseIntro() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const detail = useCaseDetail(slug);
  const cases = useCases();
  const start = useStartSession(slug);
  const activeSessionId = cases.data?.find((c) => c.slug === slug)?.activeSessionId ?? null;

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
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-amber-200">{c.title}</h1>
        <p className="text-xs text-stone-400">
          {t.difficulty[c.difficulty]} · {t.rating[c.rating]} ·{' '}
          {t.intro.baseQuestions(c.baseQuestions)} · {c.tags.map((tag) => `#${tag}`).join(' ')}
        </p>
      </header>
      <section className="whitespace-pre-line leading-relaxed text-stone-200">{c.intro}</section>
      <CaseFileView caseFile={c.caseFile} />
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
