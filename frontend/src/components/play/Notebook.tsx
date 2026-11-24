'use client';

import {
  QUESTION_LABELS,
  LABEL_TEXT,
  MEMO_MAX_LENGTH,
  RETRY_REASON_TEXT,
  type QuestionLabel,
  type SessionState,
} from '@mysterytalk/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { useExploreState, useQuestionLog, useSaveMemo } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { CaseImage, clueImageUrl, hintImageUrl } from './CaseImage';
import { VerdictBadge } from './VerdictBadge';

const TABS = ['clues', 'hints', 'questions', 'memo'] as const;
type Tab = (typeof TABS)[number];

/** 수첩(PRD D75·D48·D62·D99): 단서(진술 포함)·질문 기록·메모. 탭과 필터는 URL 상태(?tab=&filter=). */
export function Notebook({ session }: { session: SessionState }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'clues';
  const filterParam = params.get('filter');
  const filter = (QUESTION_LABELS as readonly string[]).includes(filterParam ?? '')
    ? (filterParam as QuestionLabel)
    : undefined;
  // 메모 초안은 탭과 상관없이 여기서 들고 있는다. 탭을 옮기면 메모 칸이 사라져 저장 전 글이 없어졌다
  // (코드 검수 2026-11-23). null이면 서버에 저장된 메모를 그대로 보여 준다.
  const [memoDraft, setMemoDraft] = useState<string | null>(null);

  function setParams(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.replace(`${pathname}${q.size ? `?${q.toString()}` : ''}`, { scroll: false });
  }

  function selectTab(k: Tab) {
    setParams({ tab: k === 'clues' ? null : k, filter: null });
  }

  /** ←/→/Home/End로 탭을 바꾸고 그 탭으로 포커스를 옮긴다(WAI-ARIA 탭 방식, PRD D66) */
  function onTabKey(e: React.KeyboardEvent) {
    const i = TABS.indexOf(tab);
    const keys: Record<string, Tab | undefined> = {
      ArrowRight: TABS[(i + 1) % TABS.length],
      ArrowLeft: TABS[(i + TABS.length - 1) % TABS.length],
      Home: TABS[0],
      End: TABS[TABS.length - 1],
    };
    const next = keys[e.key];
    if (!next) return;
    e.preventDefault();
    selectTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <section aria-labelledby="notebook-heading" className="flex flex-col gap-3">
      <h2 id="notebook-heading" className="tag">
        {t.notebook.heading}
      </h2>
      {/* Tab으로는 선택된 탭에만 멈춘다 */}
      <div
        role="tablist"
        aria-label={t.notebook.heading}
        className="-mb-[13px] flex gap-1 pl-2"
        onKeyDown={onTabKey}
      >
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => selectTab(k)}
            className={`rounded-t-md border border-b-0 px-3 py-1 font-serif text-sm font-bold ${tab === k ? 'relative z-10 border-line-strong bg-paper-input text-ink' : 'border-line bg-paper-3 text-ink-3 hover:text-ink-2'}`}
          >
            {t.notebook.tabs[k]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="border border-line-strong bg-paper-input p-3"
      >
        {tab === 'clues' && <ClueList session={session} />}
        {tab === 'hints' && <HintList session={session} />}
        {tab === 'questions' && (
          <QuestionLog
            sessionId={session.sessionId}
            filter={filter}
            onFilter={(f) => setParams({ filter: f ?? null })}
          />
        )}
        {tab === 'memo' && <Memo session={session} draft={memoDraft} onDraft={setMemoDraft} />}
      </div>
    </section>
  );
}

function QuestionLog({
  sessionId,
  filter,
  onFilter,
}: {
  sessionId: string;
  filter: QuestionLabel | undefined;
  onFilter: (f: QuestionLabel | undefined) => void;
}) {
  const log = useQuestionLog(sessionId, filter);
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={t.notebook.filterLabel} className="flex flex-wrap gap-1">
        {[undefined, ...QUESTION_LABELS].map((l) => (
          <button
            key={l ?? 'ALL'}
            type="button"
            aria-pressed={filter === l}
            onClick={() => onFilter(l)}
            className={`rounded-sm px-2 py-0.5 text-xs ${filter === l ? 'bg-accent text-cream' : 'border border-line bg-paper-2 text-ink-2'}`}
          >
            {l ? LABEL_TEXT[l] : t.notebook.filterAll}
          </button>
        ))}
      </div>
      {log.isPending ? (
        <p className="text-sm text-ink-3">{t.common.loading}</p>
      ) : log.error ? (
        <p role="alert" className="text-sm text-bad">
          {log.error.message}
        </p>
      ) : log.data.length === 0 ? (
        <p className="text-sm text-ink-3">{t.notebook.noQuestions}</p>
      ) : (
        <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
          {log.data.map((q) => (
            <li key={q.createdAt + q.question} className="flex items-start gap-2">
              <span className="w-8 shrink-0 text-right text-ink-3">{q.turnNo ?? '–'}</span>
              <VerdictBadge label={q.label} />
              <span className="flex-1">
                {q.question}
                {q.retryReason && (
                  <span className="block text-xs text-info">
                    {RETRY_REASON_TEXT[q.retryReason]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Memo({
  session,
  draft,
  onDraft,
}: {
  session: SessionState;
  draft: string | null;
  onDraft: Dispatch<SetStateAction<string | null>>;
}) {
  const memo = draft ?? session.memo;
  const save = useSaveMemo(session.sessionId);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        // 저장이 끝났을 때 그 사이 더 쓴 글이 없으면 초안을 비워 서버 값을 따르고, 더 썼으면 초안을 그대로 둔다
        save.mutate(memo, { onSuccess: (_, saved) => onDraft((d) => (d === saved ? null : d)) });
      }}
    >
      <label htmlFor="memo" className="text-sm text-ink-2">
        {t.notebook.memoLabel}
      </label>
      <textarea
        id="memo"
        value={memo}
        maxLength={MEMO_MAX_LENGTH}
        onChange={(e) => onDraft(e.target.value)}
        rows={8}
        className="field text-sm"
      />
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span>{t.notebook.memoPrivacy}</span>
        <span>
          {save.isSuccess && memo === save.variables && t.notebook.memoSaved}{' '}
          <button
            type="submit"
            disabled={save.isPending}
            className="btn btn-secondary ml-2 px-3 py-1"
          >
            {t.notebook.memoSave}
          </button>
        </span>
      </div>
      {save.error && (
        <p role="alert" className="text-sm text-bad">
          {save.error.message}
        </p>
      )}
    </form>
  );
}

/**
 * 힌트 탭(2026-11-24, PRD D109): 연 힌트를 번호 순으로. 그림 힌트는 눌러서 크게 본다.
 * 예전에는 단서 탭에 섞여 있었다. '놓친 단서'에는 넣지 않는다(D92).
 */
function HintList({ session }: { session: SessionState }) {
  const hints = session.hints.filter((h) => h.viewed);
  if (!hints.length) return <p className="text-sm text-ink-3">{t.notebook.noHints}</p>;
  return (
    <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
      {hints.map((h) => (
        <li key={h.no} className="border-b border-dashed border-line pb-2">
          <p className="font-semibold text-ink">{t.hints.label(h.no)}</p>
          <div className="mt-1">
            {h.image ? (
              <CaseImage
                src={hintImageUrl(session.sessionId, h.no)}
                alt={h.alt ?? ''}
                label={t.hints.label(h.no)}
              />
            ) : (
              <p className="text-ink-2">{h.text}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 단서 탭: 찾은 단서(조사·NPC 진술·연쇄). 미끼 여부는 엔딩에서만 공개한다. */
function ClueList({ session }: { session: SessionState }) {
  const sessionId = session.sessionId;
  const explore = useExploreState(sessionId);
  if (explore.isPending) return <p className="text-sm text-ink-3">{t.common.loading}</p>;
  // 불러오지 못했으면 '찾은 단서 없음'으로 보이지 않게 오류를 알린다(코드 검수 2026-11-23)
  if (explore.error && !explore.data)
    return (
      <p role="alert" className="text-sm text-bad">
        {explore.error.message}
      </p>
    );
  const clues = explore.data?.clues ?? [];
  if (!clues.length) return <p className="text-sm text-ink-3">{t.notebook.noClues}</p>;
  return (
    <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
      {clues.map((c) => (
        <li key={c.key} className="border-b border-dashed border-line pb-2">
          <p className="font-semibold text-ink">
            <span className="mr-2 rounded bg-paper-3 px-1.5 py-0.5 text-xs text-ink-2">
              {t.notebook.clueKind[c.kind]}
            </span>
            {c.title}
          </p>
          <p className="mt-1 text-ink-2">{c.content}</p>
          {c.image && (
            <div className="mt-2">
              <CaseImage src={clueImageUrl(sessionId, c.key)} alt={c.alt ?? ''} label={c.title} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
