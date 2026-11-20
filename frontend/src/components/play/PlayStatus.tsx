'use client';

import type { SessionState } from '@mysterytalk/shared';
import { useViewHint } from '@/lib/api/queries';
import { useToastStore } from '@/stores/toast';
import { t } from '@/i18n/ko';

/**
 * 추리 화면 오른쪽 맨 위(2026-11-20): 질문 진행 막대와 힌트 보기. 정답 제출·포기는 질문 칸 아래에 있다.
 * 점수·등급은 숨기고 진행 수치만 보여 준다(D76). 힌트는 언제든 순서대로 열고, 열 때마다 감점(D15).
 * 연 힌트 내용은 수첩 '단서' 탭에 쌓인다.
 */
export function PlayStatus({ session }: { session: SessionState }) {
  const view = useViewHint(session.sessionId);
  const pushToast = useToastStore((s) => s.push);
  const active = session.status === 'ACTIVE';
  const used = session.questionsUsed;
  const base = session.baseQuestions;
  const viewed = session.hints.filter((h) => h.viewed).length;
  const next = session.hints.find((h) => !h.viewed);
  const over = used > base;

  return (
    <section aria-label={t.play.statusLabel} className="flex flex-col gap-3">
      <p className={`text-xs font-semibold ${over ? 'text-warn' : 'text-ok'}`}>
        {over ? t.play.overBase(used - base, base) : t.play.toBase(base - used, base)}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-1 font-serif text-ink">
          <span className="sr-only">{t.play.usedLabel}</span>
          <span data-testid="questions-used" className="text-2xl leading-none font-bold">
            {used}
          </span>
          <span className="text-sm text-ink-3">/{base}</span>
        </p>
        <ul className="flex flex-wrap justify-end gap-1.5">
          <li className="chip">{t.play.hintsViewed(viewed, session.hints.length)}</li>
          <li className="chip">{t.play.submissionsLeft(session.submissionsLeft)}</li>
        </ul>
      </div>
      <div
        aria-hidden="true"
        className="h-1.5 overflow-hidden rounded-full border border-line bg-paper-2"
      >
        <div
          className={`h-full transition-[width] duration-500 ${over ? 'bg-warn' : 'bg-accent'}`}
          style={{ width: `${Math.min(used / base, 1) * 100}%` }}
        />
      </div>
      {active && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!next || view.isPending}
            onClick={() =>
              next &&
              view.mutate(next.no, {
                onSuccess: (r) => {
                  pushToast(t.hints.viewedToast(next.no));
                  if (r.unlockedMaps.length) pushToast(t.explore.unlocked(r.unlockedMaps));
                },
              })
            }
            className="btn btn-secondary px-2.5 py-1 text-xs"
          >
            {next ? t.hints.open(next.no, next.penalty) : t.hints.allViewed}
          </button>
        </div>
      )}
      {view.error && (
        <p role="alert" className="text-sm text-bad">
          {view.error.message}
        </p>
      )}
    </section>
  );
}
