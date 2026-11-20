'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useCaseDetail, useMe, useSessionState } from '@/lib/api/queries';
import { useDeviceHydrated, useDeviceStore } from '@/stores/device';
import { t } from '@/i18n/ko';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { CaseMeta } from '@/components/cases/CaseMeta';
import { AbandonDialog, SubmitDialog } from './Dialogs';
import { ExploreView } from './explore/ExploreView';
import { Notebook } from './Notebook';
import { PlayGuide } from './PlayGuide';
import { PlayStatus } from './PlayStatus';
import { QuestionPanel } from './QuestionPanel';
import { caseLabel } from '@/lib/play/cases';

/**
 * 추리 화면(SPEC §12, PRD D99). 왼쪽: 사건 정보 한 줄 → 현장 조사 맵 → 사건 도입.
 * 오른쪽: 진행 막대·힌트 보기 → 수첩 → 질문·정답 제출·포기(2026-11-20). 좁은 화면에서는 왼쪽 → 오른쪽 순으로 쌓인다.
 */
export function PlayScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionState(sessionId);
  const detail = useCaseDetail(session.data?.caseSlug ?? '');
  const me = useMe();
  const [dialog, setDialog] = useState<'submit' | 'abandon' | null>(null);
  // 수사 안내 팝업: 이 기기에서 처음 사건을 열 때 한 번, 이후에는 '도움말'로 연다
  const hydrated = useDeviceHydrated();
  const { guideSeen, setGuideSeen } = useDeviceStore();
  const [helpOpen, setHelpOpen] = useState(false);
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

  return (
    <div className="flex flex-col gap-4">
      {/* 머리: 로고(메인으로) · 목록으로·탐정·도움말을 한 줄에. 사건명은 왼쪽 서류 맨 위 */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-cream/20 pb-2">
        <Link href="/" className="font-serif text-xl font-bold text-cream hover:text-cream-2">
          {t.app.title}
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/cases" className="back-link">
            ← {t.common.back}
          </Link>
          {me.data && (
            <p className="paper-inset px-2.5 py-0.5 font-serif text-xs font-bold text-ink">
              {t.play.detective(me.data.detectiveName)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="btn btn-secondary px-2.5 py-0.5 text-xs"
          >
            {t.guide.help}
          </button>
        </div>
      </header>

      {!active && (
        <p className="paper p-3">
          {t.play.finished}{' '}
          <Link href={`/play/${s.sessionId}/ending`} className="link font-bold">
            {t.play.toEnding}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)]">
        <div className="paper flex min-w-0 flex-col gap-4 self-start p-4 sm:p-5">
          <div className="flex flex-col gap-0.5 border-b-2 border-ink/70 pb-2">
            {caseLabel(c) && <p className="text-xs font-semibold text-ink-3">{caseLabel(c)}</p>}
            <h1 className="text-2xl font-bold text-ink">{c.title}</h1>
          </div>
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
        {/* 오른쪽: 진행 막대·힌트 → 수첩 → 질문·정답 제출·포기(2026-11-20 배치) */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="paper p-4 sm:p-5">
            <PlayStatus session={s} />
          </div>
          <div className="paper p-4 sm:p-5">
            <Notebook session={s} />
          </div>
          <div className="paper flex flex-col gap-4 p-4 sm:p-5">
            <QuestionPanel session={s} />
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
        </div>
      </div>

      <PlayGuide
        open={helpOpen || (hydrated && !guideSeen)}
        onClose={() => {
          setGuideSeen();
          setHelpOpen(false);
        }}
      />
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
