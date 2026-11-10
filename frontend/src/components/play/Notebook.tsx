'use client';

import {
  QUESTION_LABELS,
  LABEL_TEXT,
  MEMO_MAX_LENGTH,
  RETRY_REASON_TEXT,
  type CaseFile,
  type QuestionLabel,
  type SessionState,
} from '@mysterytalk/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuestionLog, useSaveMemo } from '@/lib/api/queries';
import { t } from '@/i18n/ko';
import { CaseFileView } from './CaseFileView';
import { VerdictBadge } from './VerdictBadge';

const TABS = ['file', 'questions', 'memo'] as const;
type Tab = (typeof TABS)[number];

/** 수첩(PRD D77·D48·D62). 탭과 질문 기록 필터는 URL 상태(?tab=&filter=). 단서 탭은 4단계에서 추가한다. */
export function Notebook({ session, caseFile }: { session: SessionState; caseFile: CaseFile }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'file';
  const filterParam = params.get('filter');
  const filter = (QUESTION_LABELS as readonly string[]).includes(filterParam ?? '')
    ? (filterParam as QuestionLabel)
    : undefined;

  function setParams(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.replace(`${pathname}${q.size ? `?${q.toString()}` : ''}`, { scroll: false });
  }

  return (
    <section aria-labelledby="notebook-heading" className="flex flex-col gap-3">
      <h2 id="notebook-heading" className="font-semibold text-amber-100">
        {t.notebook.heading}
      </h2>
      <div role="tablist" aria-label={t.notebook.heading} className="flex gap-1">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setParams({ tab: k === 'file' ? null : k, filter: null })}
            className={`rounded-t px-3 py-1 text-sm ${tab === k ? 'bg-stone-800 text-amber-200' : 'text-stone-400 hover:text-stone-200'}`}
          >
            {t.notebook.tabs[k]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="rounded-b rounded-tr bg-stone-800/60 p-3"
      >
        {tab === 'file' && <CaseFileView caseFile={caseFile} />}
        {tab === 'questions' && (
          <QuestionLog
            sessionId={session.sessionId}
            filter={filter}
            onFilter={(f) => setParams({ filter: f ?? null })}
          />
        )}
        {tab === 'memo' && <Memo key={session.memo} session={session} />}
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
      <div role="group" aria-label="판정별 보기" className="flex flex-wrap gap-1">
        {[undefined, ...QUESTION_LABELS].map((l) => (
          <button
            key={l ?? 'ALL'}
            type="button"
            aria-pressed={filter === l}
            onClick={() => onFilter(l)}
            className={`rounded px-2 py-0.5 text-xs ${filter === l ? 'bg-amber-300 text-stone-900' : 'bg-stone-700 text-stone-200'}`}
          >
            {l ? LABEL_TEXT[l] : t.notebook.filterAll}
          </button>
        ))}
      </div>
      {log.isPending ? (
        <p className="text-sm text-stone-400">{t.common.loading}</p>
      ) : log.error ? (
        <p role="alert" className="text-sm text-red-300">
          {log.error.message}
        </p>
      ) : log.data.length === 0 ? (
        <p className="text-sm text-stone-400">{t.notebook.noQuestions}</p>
      ) : (
        <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
          {log.data.map((q) => (
            <li key={q.createdAt + q.question} className="flex items-start gap-2">
              <span className="w-8 shrink-0 text-right text-stone-500">{q.turnNo ?? '–'}</span>
              <VerdictBadge label={q.label} />
              <span className="flex-1">
                {q.question}
                {q.retryReason && (
                  <span className="block text-xs text-sky-300">
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

function Memo({ session }: { session: SessionState }) {
  const [memo, setMemo] = useState(session.memo);
  const save = useSaveMemo(session.sessionId);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(memo);
      }}
    >
      <label htmlFor="memo" className="text-sm text-stone-300">
        {t.notebook.memoLabel}
      </label>
      <textarea
        id="memo"
        value={memo}
        maxLength={MEMO_MAX_LENGTH}
        onChange={(e) => setMemo(e.target.value)}
        rows={8}
        className="rounded border border-stone-600 bg-stone-950 p-2 text-sm"
      />
      <div className="flex items-center justify-between text-xs text-stone-400">
        <span>{t.notebook.memoPrivacy}</span>
        <span>
          {save.isSuccess && memo === save.variables && t.notebook.memoSaved}{' '}
          <button
            type="submit"
            disabled={save.isPending}
            className="ml-2 rounded bg-stone-700 px-3 py-1 text-stone-100 hover:bg-stone-600"
          >
            {t.notebook.memoSave}
          </button>
        </span>
      </div>
      {save.error && (
        <p role="alert" className="text-sm text-red-300">
          {save.error.message}
        </p>
      )}
    </form>
  );
}
