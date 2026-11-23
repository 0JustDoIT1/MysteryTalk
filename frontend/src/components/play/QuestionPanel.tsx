'use client';

import {
  QUESTION_MAX_LENGTH,
  RETRY_REASON_TEXT,
  type AskQuestionResponse,
  type QuestionLabel,
  type SessionState,
} from '@mysterytalk/shared';
import { useState } from 'react';
import { ApiError, isRetryable } from '@/lib/api/client';
import { useAskQuestion, useMe } from '@/lib/api/queries';
import { keyFor, type PendingRequest } from '@/lib/play/idempotency';
import { useToastStore } from '@/stores/toast';
import { t } from '@/i18n/ko';
import { useSfx } from '@/lib/audio/use-sfx';
import { MicButton } from './MicButton';
import { VerdictBadge } from './VerdictBadge';

/** seq: 답변마다 늘어나는 번호(같은 판정이 이어져도 도장 효과를 다시 보여 주려고 key 로 쓴다) */
type Shown = { question: string; response: AskQuestionResponse; seq: number };

/** 답변이 온 순간 화면 가장자리를 빛낼 색(판정별) */
const EDGE: Record<QuestionLabel, string> = {
  // 색은 globals.css의 --glow-* 토큰(.edge-glow)
  YES: 'edge-glow [--glow:var(--glow-yes)]',
  NO: 'edge-glow [--glow:var(--glow-no)]',
  MAYBE: 'edge-glow [--glow:var(--glow-maybe)]',
  IRRELEVANT: 'edge-glow [--glow:var(--glow-irrelevant)] [--glow-soft:50%]',
  RETRY: 'edge-glow [--glow:var(--glow-retry)]',
};

/** 판정 도장 색. 글자(판정 문구)와 함께 보여 색만으로 구분하지 않는다(D66) */
const STAMP: Record<QuestionLabel, string> = {
  YES: 'border-ok text-ok bg-ok-bg/70',
  NO: 'border-bad text-bad bg-bad-bg/70',
  MAYBE: 'border-warn text-warn bg-warn-bg/70',
  IRRELEVANT: 'border-ink-3 text-ink-2 bg-neutral-bg/70',
  RETRY: 'border-info text-info bg-info-bg/70',
};

/**
 * 질문 입력과 판정 표시(SPEC §6, §12.1).
 * - 판정 대기 중 입력 잠금 + '수사 중…'(D87), 결과는 화면 낭독기로 알림(D66)
 * - 한글 조합 중 Enter는 제출하지 않음
 * - 판정 지연·네트워크 오류는 같은 문장이면 같은 멱등성 키로 재전송(이중 차감 없음)
 */
export function QuestionPanel({ session }: { session: SessionState }) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const ask = useAskQuestion(session.sessionId);
  const pushToast = useToastStore((s) => s.push);
  const play = useSfx();
  const me = useMe();
  const capReached = session.questionsUsed >= session.questionCap;
  const disabled = ask.isPending || capReached || session.status !== 'ACTIVE';

  function send(override?: string) {
    const question = (override ?? text).trim();
    if (!question || disabled) return;
    const request = keyFor(pending, question);
    setPending(request);
    ask.mutate(
      { question, key: request.key },
      {
        onSuccess: (response) => {
          setPending(null);
          setShown((prev) => ({ question, response, seq: (prev?.seq ?? 0) + 1 }));
          play(response.label);
          if (response.unlockedMaps.length) play('unlock');
          setText('');
          if (response.unlockedMaps.length) pushToast(t.explore.unlocked(response.unlockedMaps));
        },
        onError: (error) => {
          if (!isRetryable(error)) setPending(null);
        },
      },
    );
  }

  const retryable = ask.error && isRetryable(ask.error) && pending?.text === text.trim();

  return (
    <section aria-label={t.play.questionSection} className="flex flex-col gap-3">
      <div
        aria-live="polite"
        // 답이 오기 전에는 상자를 접어 둔다(알림 영역은 남겨 화면 낭독기가 답을 읽는다)
        className={
          ask.isPending || shown || ask.error
            ? 'min-h-36 border border-line bg-paper-input ruled p-4 shadow-inner'
            : undefined
        }
      >
        {ask.isPending ? (
          <p className="animate-pulse text-ink-2">{t.play.judging}</p>
        ) : shown ? (
          <div key={shown.seq} className="flex flex-col gap-2">
            {/* 화면 가장자리 빛(장식, 클릭을 막지 않음). 움직임 줄이기 설정이면 보이지 않는다 */}
            <div
              aria-hidden="true"
              data-testid="verdict-flash"
              className={`pointer-events-none fixed inset-0 z-40 animate-edge-flash motion-reduce:hidden ${EDGE[shown.response.label]}`}
            />
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif font-bold text-ink">{shown.question}</p>
              <VerdictBadge label={shown.response.label} />
            </div>
            {/* 판정 도장: 답변이 왔다는 느낌을 주는 찍히는 효과(움직임 줄이기 설정이면 효과 없음) */}
            <div className="flex justify-center py-2">
              <p
                className={`animate-stamp rounded-sm border-2 px-5 py-2 font-serif text-xl font-bold shadow-sm motion-reduce:animate-none ${STAMP[shown.response.label]}`}
              >
                {t.verdict[shown.response.label]}
              </p>
            </div>
            {shown.response.retryReason && (
              <p className="text-center text-sm text-info">
                {RETRY_REASON_TEXT[shown.response.retryReason]}
              </p>
            )}
            {shown.response.duplicate ? (
              <p className="text-xs text-ink-3">{t.play.duplicate}</p>
            ) : (
              !shown.response.counted && <p className="text-xs text-ink-3">{t.play.notCounted}</p>
            )}
          </div>
        ) : null}
        {ask.error && !ask.isPending && (
          <p role="alert" className="mt-2 text-sm text-bad">
            {ask.error.message} {retryable && t.play.retryAvailable}
            {ask.error instanceof ApiError &&
              ask.error.code === 'DAILY_LIMIT_REACHED' &&
              me.data?.kind === 'GUEST' &&
              me.data.loginAvailable && (
                <a href="/api/auth/google" className="link ml-1">
                  {t.play.limitLogin}
                </a>
              )}
          </p>
        )}
      </div>

      {capReached ? (
        <p className="paper-inset px-3 py-2 text-sm text-ink">{t.play.capReached}</p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="question" className="text-sm font-semibold text-ink-2">
            {t.play.questionHeading}
          </label>
          {/* 첫 질문 전: 눌러서 바로 묻는 일반 질문 */}
          {session.questionsUsed === 0 && !shown && !disabled && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-ok">{t.play.starterTitle}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.play.starterQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="rounded-full border border-line-strong bg-paper-2 px-3 py-1 text-xs font-semibold text-ink hover:bg-paper-3"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {/* 두 줄이 보이는 입력 상자. 질문은 한 문장이라 줄바꿈은 넣지 않고 Enter로 바로 보낸다 */}
            <textarea
              id="question"
              aria-label={t.play.questionLabel}
              rows={2}
              value={text}
              maxLength={QUESTION_MAX_LENGTH}
              onChange={(e) => setText(e.target.value.replace(/\r?\n/g, ' '))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                // 한글 조합 중 Enter는 조합 완료로만 쓰고 보내지 않는다
                if (!e.nativeEvent.isComposing) send();
              }}
              disabled={disabled}
              placeholder={
                t.play.questionPlaceholders[(shown?.seq ?? 0) % t.play.questionPlaceholders.length]
              }
              autoComplete="off"
              className="field min-h-16 min-w-0 flex-1 resize-none text-sm leading-relaxed disabled:opacity-60"
            />
            <MicButton
              large
              disabled={disabled}
              onText={(spoken) => setText(spoken.slice(0, QUESTION_MAX_LENGTH))}
            />
          </div>
          <p className="flex justify-between gap-2 text-xs text-ink-3">
            <span>{t.play.negationTip}</span>
            <span className="shrink-0">
              {t.play.lengthHint(text.trim().length, QUESTION_MAX_LENGTH)}
            </span>
          </p>
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="btn btn-primary w-full py-2.5"
          >
            {retryable ? t.common.retry : t.play.ask}
          </button>
        </form>
      )}
    </section>
  );
}
