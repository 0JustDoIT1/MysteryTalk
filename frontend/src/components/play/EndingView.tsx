'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEnding, useSessionState, useStartSession } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

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

  if (session.isPending || (finished && ending.isPending))
    return <p className="text-stone-400">{t.common.loading}</p>;
  if (session.error || ending.error)
    return (
      <p role="alert" className="text-red-300">
        {(session.error ?? ending.error)?.message}{' '}
        <Link href="/cases" className="underline">
          {t.common.back}
        </Link>
      </p>
    );
  if (!finished || !ending.data)
    return (
      <p>
        <Link href={`/play/${sessionId}`} className="underline">
          {t.common.back}
        </Link>
      </p>
    );

  const e = ending.data;
  const b = e.breakdown;
  const showRules = e.isTutorial;
  const rows = [
    { label: t.ending.base, value: `${b.base}`, rule: null },
    {
      label: t.ending.questionPenalty,
      value: `-${b.questionPenalty}`,
      rule: t.ending.rules.question(
        b.baseQuestions,
        b.questionPenaltyPerExtra,
        b.questionPenaltyMax,
      ),
    },
    {
      label: t.ending.hintPenalty,
      value: `-${b.hintPenalty}`,
      rule: t.ending.rules.hint(b.hintPenaltySteps),
    },
    {
      label: t.ending.wrongPenalty,
      value: `-${b.wrongPenalty}`,
      rule: t.ending.rules.wrong(b.wrongPenaltyEach),
    },
  ];

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-stone-400">
          {e.title} · {t.ending.playNo(e.playNo)}
        </p>
        <h1 className="text-2xl font-bold text-amber-200">{t.ending.heading}</h1>
      </header>

      <section
        aria-live="polite"
        className="flex items-center gap-6 rounded-lg border border-stone-700 bg-stone-900 p-5"
      >
        <div className="text-center">
          <p className="text-xs text-stone-400">{t.ending.grade}</p>
          <p className="text-5xl font-black text-amber-200">{e.grade}</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{t.ending.status[e.status]}</p>
          <p className="text-sm text-stone-300">
            {e.score !== null ? `${t.ending.score} ${e.score}` : t.ending.noScore}
          </p>
        </div>
      </section>

      {e.isTutorial && (
        <p className="rounded border border-sky-500/50 bg-sky-950/60 p-3 text-sm text-sky-100">
          {t.ending.tutorialNote}
        </p>
      )}

      <section aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" className="mb-2 font-semibold text-amber-100">
          {t.ending.breakdown}
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-stone-800">
                <th scope="row" className="py-2 text-left font-normal">
                  {r.label}
                  {showRules && r.rule && (
                    <span className="block text-xs text-stone-400">{r.rule}</span>
                  )}
                </th>
                <td className="py-2 text-right tabular-nums">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {showRules && (
          <p className="mt-2 text-xs text-stone-400">
            {t.ending.rules.grades(b.gradeCuts.S, b.gradeCuts.A, b.gradeCuts.B)}
          </p>
        )}
      </section>

      <section aria-labelledby="elements-heading">
        <h2 id="elements-heading" className="mb-2 font-semibold text-amber-100">
          {t.ending.elements}
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {e.elements.map((el) => (
            <li key={el.id} className="flex items-start gap-2">
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs ${el.matched ? 'bg-emerald-900 text-emerald-100' : 'bg-stone-700 text-stone-200'}`}
              >
                {el.matched ? `○ ${t.ending.matched}` : `✕ ${t.ending.missed}`}
              </span>
              <span>
                <span className="mr-1 text-xs text-stone-400">
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
          <h2 id="clues-heading" className="mb-2 font-semibold text-amber-100">
            {t.ending.clues}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {e.clues.map((c) => (
              <li key={c.title} className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${c.found ? 'bg-emerald-900 text-emerald-100' : 'bg-stone-700 text-stone-200'}`}
                >
                  {c.found ? `○ ${t.ending.clueFound}` : `✕ ${t.ending.clueMissed}`}
                </span>
                <span>{c.title}</span>
                {c.decoy && (
                  <span className="rounded bg-rose-900 px-2 py-0.5 text-xs text-rose-100">
                    {t.ending.decoy}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="explanation-heading">
        <h2 id="explanation-heading" className="mb-2 font-semibold text-amber-100">
          {t.ending.explanation}
        </h2>
        <p className="whitespace-pre-line leading-relaxed text-stone-200">{e.explanation}</p>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={again.isPending}
          onClick={() =>
            again.mutate(undefined, {
              onSuccess: ({ sessionId: next }) => router.push(`/play/${next}`),
            })
          }
          className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900 hover:bg-amber-200 disabled:opacity-50"
        >
          {t.ending.playAgain}
        </button>
        <Link href="/cases" className="rounded px-4 py-2 text-stone-300 hover:bg-stone-800">
          {t.common.back}
        </Link>
      </div>
      {again.error && (
        <p role="alert" className="text-sm text-red-300">
          {again.error.message}
        </p>
      )}
    </article>
  );
}
