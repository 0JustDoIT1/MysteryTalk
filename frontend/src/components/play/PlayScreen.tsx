'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useCaseDetail, useExploreState, useQuestionLog, useSessionState } from '@/lib/api/queries';
import { tutorialStep } from '@/lib/play/tutorial';
import { t } from '@/i18n/ko';
import { AbandonDialog, SubmitDialog } from './Dialogs';
import { ExploreView } from './explore/ExploreView';
import { HintPanel } from './HintPanel';
import { Notebook } from './Notebook';
import { QuestionPanel } from './QuestionPanel';

/** 추리 화면(SPEC §12): 질문·판정, 진행 수치, 힌트, 수첩, 정답 제출, 사건 메뉴(포기). */
export function PlayScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionState(sessionId);
  const detail = useCaseDetail(session.data?.caseSlug ?? '');
  const log = useQuestionLog(sessionId);
  const explore = useExploreState(sessionId);
  const [dialog, setDialog] = useState<'submit' | 'abandon' | null>(null);
  const [guideClosed, setGuideClosed] = useState(false);

  if (session.isPending || (session.data && detail.isPending))
    return <p className="text-stone-400">{t.common.loading}</p>;
  if (session.error || detail.error)
    return (
      <p role="alert" className="text-red-300">
        {(session.error ?? detail.error)?.message}{' '}
        <Link href="/" className="underline">
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link
            href={`/cases/${s.caseSlug}`}
            className="text-sm text-stone-400 hover:text-stone-200"
          >
            ← {c.title}
          </Link>
          <h1 className="text-2xl font-bold text-amber-200">{c.title}</h1>
        </div>
        {/* 진행 수치만 보여 주고 점수·등급은 엔딩에서 공개한다(D76). */}
        <ul aria-label="진행 상황" className="flex flex-wrap gap-3 text-sm text-stone-300">
          <li>{t.play.questions(s.questionsUsed, s.baseQuestions)}</li>
          <li>{t.play.hintsViewed(viewed)}</li>
          <li>{t.play.submissionsLeft(s.submissionsLeft)}</li>
        </ul>
      </header>

      {s.isTutorial && active && !guideClosed && (
        <aside
          aria-label={t.tutorial.label}
          className="flex items-start justify-between gap-3 rounded-lg border border-sky-500/50 bg-sky-950/60 p-3 text-sm text-sky-100"
        >
          <p>
            <span className="mr-2 font-semibold">
              {step + 1}/{t.tutorial.steps.length}
            </span>
            {t.tutorial.steps[step]}
          </p>
          <button type="button" onClick={() => setGuideClosed(true)} className="shrink-0 underline">
            {t.tutorial.dismiss}
          </button>
        </aside>
      )}

      {!active && (
        <p className="rounded-lg border border-stone-600 bg-stone-900 p-3">
          {t.play.finished}{' '}
          <Link
            href={`/play/${s.sessionId}/ending`}
            className="font-semibold text-amber-200 underline"
          >
            {t.play.toEnding}
          </Link>
        </p>
      )}

      {/* PC: 현장 조사 맵과 질문창을 나란히(4단계 결정). 좁은 화면에서는 위아래로 쌓인다. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,auto)_minmax(22rem,1fr)]">
        <div className="flex flex-col gap-6">
          <ExploreView session={s} />
          <HintPanel session={s} />
        </div>
        <div className="flex flex-col gap-6">
          <QuestionPanel session={s} />
          {active && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialog('submit')}
                className="rounded bg-emerald-300 px-4 py-2 font-semibold text-stone-900 hover:bg-emerald-200"
              >
                {t.play.submit}
              </button>
              <button
                type="button"
                onClick={() => setDialog('abandon')}
                className="rounded px-4 py-2 text-sm text-stone-400 hover:bg-stone-800 hover:text-rose-200"
              >
                {t.play.abandon}
              </button>
            </div>
          )}
          <Notebook session={s} caseFile={c.caseFile} />
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
