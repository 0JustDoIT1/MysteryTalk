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
    return <p className="text-stone-400">{t.common.loading}</p>;
  if (session.error || detail.error)
    return (
      <p role="alert" className="text-red-300">
        {(session.error ?? detail.error)?.message}{' '}
        <Link href="/cases" className="underline">
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
          {me.data && (
            <p className="text-xs text-stone-400">{t.play.detective(me.data.detectiveName)}</p>
          )}
        </div>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)]">
        <div className="flex flex-col gap-4">
          <CaseMeta
            genres={c.genres}
            difficulty={c.difficulty}
            baseQuestions={c.baseQuestions}
            maxQuestions={c.maxQuestions}
            elementCount={c.elementCount}
          />
          <ExploreView session={s} />
          {/* PC: 맵 아래에 펼쳐 둔다. 좁은 화면: 질문창이 멀어지지 않게 접어 둔다(소개 화면에서 이미 읽음). */}
          <section aria-labelledby="intro-heading" className="hidden flex-col gap-2 lg:flex">
            <h2 id="intro-heading" className="font-semibold text-amber-100">
              {t.intro.heading}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-stone-200">{c.intro}</p>
          </section>
          <details className="rounded-lg bg-stone-900 px-3 py-2 lg:hidden">
            <summary className="cursor-pointer font-semibold text-amber-100">
              {t.intro.heading}
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-200">
              {c.intro}
            </p>
          </details>
        </div>
        <div className="flex flex-col gap-6">
          {/* 진행 수치만 보여 주고 점수·등급은 엔딩에서 공개한다(D76). */}
          <ul
            aria-label="진행 상황"
            className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-stone-900 px-3 py-2 text-sm text-stone-200"
          >
            <li>{t.play.questions(s.questionsUsed, s.baseQuestions)}</li>
            <li>{t.play.hintsViewed(viewed)}</li>
            <li>{t.play.submissionsLeft(s.submissionsLeft)}</li>
          </ul>
          <QuestionPanel session={s} />
          <HintPanel session={s} />
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
          <Notebook session={s} />
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
