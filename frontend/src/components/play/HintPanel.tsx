'use client';

import type { SessionState } from '@mysterytalk/shared';
import { useViewHint } from '@/lib/api/queries';
import { useToastStore } from '@/stores/toast';
import { t } from '@/i18n/ko';
import { CaseImage, hintImageUrl } from './CaseImage';

/** 힌트(PRD D15·D17·D81): 해금된 것만 순서대로 열고, 다음 힌트까지 남은 질문 수를 보여 준다. */
export function HintPanel({ session }: { session: SessionState }) {
  const view = useViewHint(session.sessionId);
  const pushToast = useToastStore((s) => s.push);
  const active = session.status === 'ACTIVE';

  return (
    <section aria-labelledby="hints-heading" className="flex flex-col gap-2">
      <h2 id="hints-heading" className="tag">
        {t.hints.heading}
      </h2>
      <p className="text-xs text-ink-3">{t.hints.penaltyNote}</p>
      <ul className="flex flex-col gap-2">
        {session.hints.map((h, i) => {
          const previousViewed = session.hints.slice(0, i).every((p) => p.viewed);
          if (h.viewed)
            return (
              <li key={h.no} className="border border-gold bg-warn-bg/60 p-3 text-sm">
                <span className="mr-2 font-serif font-bold text-warn">#{h.no}</span>
                {h.image ? (
                  <CaseImage
                    src={hintImageUrl(session.sessionId, h.no)}
                    alt={h.alt ?? ''}
                    label={t.hints.label(h.no)}
                  />
                ) : (
                  h.text
                )}
              </li>
            );
          if (!h.unlocked)
            return (
              <li key={h.no} className="paper-inset px-3 py-1.5 text-sm text-ink-3">
                🔒 {t.hints.locked(h.no, h.unlockAt - session.questionsUsed)}
              </li>
            );
          if (!previousViewed)
            return (
              <li key={h.no} className="text-sm text-ink-3">
                {t.hints.waiting(h.no)}
              </li>
            );
          return (
            <li key={h.no}>
              <button
                type="button"
                disabled={!active || view.isPending}
                onClick={() =>
                  view.mutate(h.no, {
                    onSuccess: (r) => {
                      if (r.unlockedMaps.length) pushToast(t.explore.unlocked(r.unlockedMaps));
                    },
                  })
                }
                className="btn btn-secondary w-full justify-between px-3 py-1.5 text-sm"
              >
                {t.hints.open(h.no, h.penalty)}
              </button>
            </li>
          );
        })}
      </ul>
      {view.error && (
        <p role="alert" className="text-sm text-bad">
          {view.error.message}
        </p>
      )}
    </section>
  );
}
