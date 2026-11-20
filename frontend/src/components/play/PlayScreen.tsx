'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  useCaseDetail,
  useExploreState,
  useMe,
  useQuestionLog,
  useSessionState,
} from '@/lib/api/queries';
import { tutorialStep } from '@/lib/play/tutorial';
import { t } from '@/i18n/ko';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { CaseMeta } from '@/components/cases/CaseMeta';
import { AbandonDialog, SubmitDialog } from './Dialogs';
import { ExploreView } from './explore/ExploreView';
import { HintPanel } from './HintPanel';
import { Notebook } from './Notebook';
import { QuestionPanel } from './QuestionPanel';

/**
 * 추리 화면(SPEC §12, PRD D99). 왼쪽: 사건 정보 한 줄 → 현장 조사 맵 → 사건 도입.
 * 오른쪽: 진행 수치 → 질문 → 힌트 → 정답 제출·포기 → 수첩. 좁은 화면에서는 왼쪽 → 오른쪽 순으로 쌓인다.
 */
export function PlayScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionState(sessionId);
  const detail = useCaseDetail(session.data?.caseSlug ?? '');
  const log = useQuestionLog(sessionId);
  const explore = useExploreState(sessionId);
  const me = useMe();
  const [dialog, setDialog] = useState<'submit' | 'abandon' | null>(null);
  const [guideClosed, setGuideClosed] = useState(false);
  useDocumentTitle(detail.data?.title);

  if (session.isPending || (session.data && detail.isPending))
    return <p className="text-cream-2">{t.common.loading}</p>;
  if (session.error || detail.error)
    return (
      <p role="alert" className="paper p-4 text-bad">
        {(session.error ?? detail.error)?.message}{' '}
        <Link href="/cases" className="link">
          {t.common.back}
        </Link>
      </p>
    );
  const s = session.data!;
  const c = detail.data!;
  const active = s.status === 'ACTIVE';
  const viewed = s.hints.filter((h) => h.viewed).length;
  const step = tutorialStep(s, (log.data?.length ?? 0) > 0, explore.data?.clues.length ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-cream/20 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={`/cases/${s.caseSlug}`} className="back-link w-fit">
            ← {c.title}
          </Link>
          <h1 className="text-3xl font-bold text-cream drop-shadow-[0_2px_0_rgb(0_0_0/0.5)]">
            {c.title}
          </h1>
        </div>
        {me.data && (
          <p className="paper-inset px-3 py-1 font-serif text-sm font-bold text-ink">
            {t.play.detective(me.data.detectiveName)}
          </p>
        )}
      </header>

      {s.isTutorial && active && !guideClosed && (
        <aside
          aria-label={t.tutorial.label}
          className="paper flex items-start justify-between gap-3 border-l-4 border-l-info p-3 text-sm"
        >
          <p>
            <span className="mr-2 font-serif font-bold text-info">
              {step + 1}/{t.tutorial.steps.length}
            </span>
            {t.tutorial.steps[step]}
          </p>
          <button type="button" onClick={() => setGuideClosed(true)} className="link shrink-0">
            {t.tutorial.dismiss}
          </button>
        </aside>
      )}

      {!active && (
        <p className="paper p-3">
          {t.play.finished}{' '}
          <Link href={`/play/${s.sessionId}/ending`} className="link font-bold">
            {t.play.toEnding}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)]">
        <div className="paper flex min-w-0 flex-col gap-4 self-start p-4 sm:p-5">
          <CaseMeta
            genres={c.genres}
            difficulty={c.difficulty}
            baseQuestions={c.baseQuestions}
            maxQuestions={c.maxQuestions}
            elementCount={c.elementCount}
          />
          <ExploreView session={s} />
          {/* PC: 맵 아래에 펼쳐 둔다. 좁은 화면: 질문창이 멀어지지 않게 접어 둔다(소개 화면에서 이미 읽음). */}
          <section
            aria-labelledby="intro-heading"
            className="hidden flex-col gap-2 border-t border-dashed border-line pt-4 lg:flex"
          >
            <h2 id="intro-heading" className="label">
              {t.intro.heading}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{c.intro}</p>
          </section>
          <details className="paper-inset px-3 py-2 lg:hidden">
            <summary className="cursor-pointer font-serif font-bold text-ink">
              {t.intro.heading}
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">{c.intro}</p>
          </details>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="paper flex flex-col gap-4 p-4 sm:p-5">
            {/* 진행 수치만 보여 주고 점수·등급은 엔딩에서 공개한다(D76). */}
            <ul
              aria-label="진행 상황"
              className="grid grid-cols-3 divide-x divide-line border border-line bg-paper-2 text-center text-xs text-ink-2 sm:text-sm"
            >
              <li className="px-2 py-1.5">{t.play.questions(s.questionsUsed, s.baseQuestions)}</li>
              <li className="px-2 py-1.5">{t.play.hintsViewed(viewed)}</li>
              <li className="px-2 py-1.5">{t.play.submissionsLeft(s.submissionsLeft)}</li>
            </ul>
            <QuestionPanel session={s} />
          </div>
          <div className="paper flex flex-col gap-4 p-4 sm:p-5">
            <HintPanel session={s} />
            {active && (
              <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-4">
                <button
                  type="button"
                  onClick={() => setDialog('submit')}
                  className="btn btn-primary"
                >
                  {t.play.submit}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog('abandon')}
                  className="btn btn-ghost text-sm hover:text-bad"
                >
                  {t.play.abandon}
                </button>
              </div>
            )}
          </div>
          <div className="paper p-4 sm:p-5">
            <Notebook session={s} />
          </div>
        </div>
      </div>

      {/* 확인 창은 항상 렌더링한다. 종료 직후 상태가 바뀌어도 사라지지 않아야 엔딩으로 이동할 수 있다. */}
      <SubmitDialog session={s} open={dialog === 'submit'} onClose={() => setDialog(null)} />
      <AbandonDialog
        sessionId={s.sessionId}
        open={dialog === 'abandon'}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
