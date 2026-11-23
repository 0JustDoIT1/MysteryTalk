'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEnding, useSessionState, useStartSession } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

/**
 * 엔딩(PRD D19·D61): 결과·등급, 점수 내역, 요소별 충족, 진상 해설, 다시 하기.
 * 튜토리얼은 같은 내역에 감점 규칙 설명을 붙이고 기록에 남지 않음을 알린다(PRD v1.3).
 */
export function EndingView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const session = useSessionState(sessionId);
  const finished = !!session.data && session.data.status !== 'ACTIVE';
  const ending = useEnding(sessionId, finished);
  const again = useStartSession(session.data?.caseSlug ?? '');
  useDocumentTitle(ending.data ? `${ending.data.title} 결과` : undefined);

  if (session.isPending || (finished && ending.isPending))
    return <p className="text-cream-2">{t.common.loading}</p>;
  // 처음 불러오기에 실패했을 때만 오류 화면. 이미 받은 데이터가 있으면 그대로 보여 준다(코드 검수 2026-11-23)
  if ((session.error && !session.data) || (ending.error && !ending.data))
    return (
      <p role="alert" className="paper p-4 text-bad">
        {(session.error ?? ending.error)?.message}{' '}
        <Link href="/cases" className="link">
          {t.common.back}
        </Link>
      </p>
    );
  if (!finished || !ending.data)
    return (
      <p className="paper p-4">
        <Link href={`/play/${sessionId}`} className="link">
          {t.common.back}
        </Link>
      </p>
    );

  const e = ending.data;
  const b = e.breakdown;
  const deductions = [
    [t.ending.deduction.question, b.questionPenalty],
    [t.ending.deduction.hint, b.hintPenalty],
    [t.ending.deduction.wrong, b.wrongPenalty],
  ]
    .filter(([, v]) => Number(v) > 0)
    .map(([label, v]) => `${label} −${v}`);

  return (
    <article className="paper flex min-w-0 flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-col gap-1 border-b-2 border-ink/70 pb-3">
        <p className="text-xs font-semibold text-ink-3">
          {e.title} · {t.ending.playNo(e.playNo)}
        </p>
        <h1 className="text-3xl font-bold text-ink">{t.ending.heading}</h1>
      </header>

      <section aria-live="polite" className="paper-inset flex items-center gap-6 p-5">
        <div className="text-center">
          <p className="mb-2 text-xs text-ink-3">{t.ending.grade}</p>
          <p className="stamp px-4 text-5xl">{e.grade}</p>
        </div>
        <div>
          <p className="font-serif text-xl font-bold">{t.ending.status[e.status]}</p>
          <p className="text-sm text-ink-2">
            {e.score !== null ? `${t.ending.score} ${e.score}` : t.ending.noScore}
          </p>
          {e.score !== null && deductions.length > 0 && (
            <p className="mt-1 text-xs text-ink-3">{t.ending.deductions(deductions)}</p>
          )}
        </div>
      </section>

      {e.isTutorial && (
        <p className="border-l-4 border-info bg-info-bg p-3 text-sm text-info">
          {t.ending.tutorialNote}
        </p>
      )}

      <section aria-labelledby="elements-heading">
        <h2 id="elements-heading" className="label mb-2">
          {t.ending.elements}
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {e.elements.map((el) => (
            <li key={el.id} className="flex items-start gap-2">
              <span
                className={`shrink-0 rounded-sm px-2 py-0.5 text-xs ${el.matched ? 'bg-ok-bg text-ok' : 'bg-paper-3 text-ink-2'}`}
              >
                {el.matched ? `○ ${t.ending.matched}` : `✕ ${t.ending.missed}`}
              </span>
              <span>
                <span className="mr-1 text-xs text-ink-3">
                  [{el.required ? t.ending.required : t.ending.optional}]
                </span>
                {el.description}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {e.clues.length > 0 && (
        <section aria-labelledby="clues-heading">
          <h2 id="clues-heading" className="label mb-2">
            {t.ending.clues}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {e.clues.map((c) => (
              <li key={c.title} className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-sm px-2 py-0.5 text-xs ${c.found ? 'bg-ok-bg text-ok' : 'bg-paper-3 text-ink-2'}`}
                >
                  {c.found ? `○ ${t.ending.clueFound}` : `✕ ${t.ending.clueMissed}`}
                </span>
                <span>{c.title}</span>
                {c.decoy && (
                  <span className="rounded bg-bad-bg px-2 py-0.5 text-xs text-bad">
                    {t.ending.decoy}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="explanation-heading">
        <h2 id="explanation-heading" className="label mb-2">
          {t.ending.explanation}
        </h2>
        <p className="whitespace-pre-line leading-relaxed text-ink-2">{e.explanation}</p>
      </section>

      <div className="flex gap-3 border-t border-dashed border-line pt-4">
        <button
          type="button"
          disabled={again.isPending}
          onClick={() =>
            again.mutate(undefined, {
              onSuccess: ({ sessionId: next }) => router.push(`/play/${next}`),
            })
          }
          className="btn btn-primary"
        >
          {t.ending.playAgain}
        </button>
        <Link href="/cases" className="btn btn-ghost">
          {t.common.back}
        </Link>
      </div>
      {again.error && (
        <p role="alert" className="text-sm text-bad">
          {again.error.message}
        </p>
      )}
    </article>
  );
}
