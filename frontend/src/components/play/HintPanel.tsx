'use client';

import type { SessionState } from '@mysterytalk/shared';
import { useViewHint } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 힌트(PRD D15·D17·D81): 해금된 것만 순서대로 열고, 다음 힌트까지 남은 질문 수를 보여 준다. */
export function HintPanel({ session }: { session: SessionState }) {
  const view = useViewHint(session.sessionId);
  const active = session.status === 'ACTIVE';

  return (
    <section aria-labelledby="hints-heading" className="flex flex-col gap-2">
      <h2 id="hints-heading" className="font-semibold text-amber-100">
        {t.hints.heading}
      </h2>
      <p className="text-xs text-stone-400">{t.hints.penaltyNote}</p>
      <ul className="flex flex-col gap-2">
        {session.hints.map((h, i) => {
          const previousViewed = session.hints.slice(0, i).every((p) => p.viewed);
          if (h.viewed)
            return (
              <li
                key={h.no}
                className="rounded border border-amber-400/30 bg-stone-900 p-3 text-sm"
              >
                <span className="mr-2 font-semibold text-amber-200">#{h.no}</span>
                {h.text}
              </li>
            );
          if (!h.unlocked)
            return (
              <li key={h.no} className="text-sm text-stone-500">
                🔒 {t.hints.locked(h.no, h.unlockAt - session.questionsUsed)}
              </li>
            );
          if (!previousViewed)
            return (
              <li key={h.no} className="text-sm text-stone-500">
                {t.hints.waiting(h.no)}
              </li>
            );
          return (
            <li key={h.no}>
              <button
                type="button"
                disabled={!active || view.isPending}
                onClick={() => view.mutate(h.no)}
                className="rounded border border-amber-300 px-3 py-1 text-sm text-amber-200 hover:bg-amber-300/10 disabled:opacity-50"
              >
                {t.hints.open(h.no)}
              </button>
            </li>
          );
        })}
      </ul>
      {view.error && (
        <p role="alert" className="text-sm text-red-300">
          {view.error.message}
        </p>
      )}
    </section>
  );
}
