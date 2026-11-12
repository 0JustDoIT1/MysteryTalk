'use client';

import {
  QUESTION_MAX_LENGTH,
  RETRY_REASON_TEXT,
  type AskQuestionResponse,
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

type Shown = { question: string; response: AskQuestionResponse };

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

  function send() {
    const question = text.trim();
    if (!question || disabled) return;
    const request = keyFor(pending, question);
    setPending(request);
    ask.mutate(
      { question, key: request.key },
      {
        onSuccess: (response) => {
          setPending(null);
          setShown({ question, response });
          play(response.label);
          if (response.unlockedMaps.length) play('unlock');
          setText('');
          if (response.unlockedMaps.length) pushToast(t.explore.unlocked(response.unlockedMaps));
          if (response.counted) {
            for (const h of session.hints) {
              if (h.unlockAt === response.questionsUsed) pushToast(t.hints.unlockedToast(h.no));
            }
          }
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
        className="min-h-16 rounded-lg border border-stone-700 bg-stone-900 p-4"
      >
        {ask.isPending ? (
          <p className="animate-pulse text-stone-300">{t.play.judging}</p>
        ) : shown ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-400">Q. {shown.question}</p>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge label={shown.response.label} size="lg" />
              {shown.response.retryReason && (
                <span className="text-sm text-sky-200">
                  {RETRY_REASON_TEXT[shown.response.retryReason]}
                </span>
              )}
            </div>
            {shown.response.duplicate ? (
              <p className="text-xs text-stone-400">{t.play.duplicate}</p>
            ) : (
              !shown.response.counted && (
                <p className="text-xs text-stone-400">{t.play.notCounted}</p>
              )
            )}
          </div>
        ) : null}
        {ask.error && !ask.isPending && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {ask.error.message} {retryable && t.play.retryAvailable}
            {ask.error instanceof ApiError &&
              ask.error.code === 'DAILY_LIMIT_REACHED' &&
              me.data?.kind === 'GUEST' &&
              me.data.loginAvailable && (
                <a href="/api/auth/google" className="ml-1 text-amber-200 underline">
                  {t.play.limitLogin}
                </a>
              )}
          </p>
        )}
      </div>

      {capReached ? (
        <p className="text-sm text-amber-200">{t.play.capReached}</p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="question" className="text-sm text-stone-300">
            {t.play.questionLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="question"
              value={text}
              maxLength={QUESTION_MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter는 조합 완료로만 쓰고 제출하지 않는다.
                if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
              }}
              disabled={disabled}
              placeholder={t.play.questionPlaceholder}
              autoComplete="off"
              className="flex-1 rounded border border-stone-600 bg-stone-950 px-3 py-2 text-stone-100 disabled:opacity-60"
            />
            <MicButton
              disabled={disabled}
              onText={(spoken) => setText(spoken.slice(0, QUESTION_MAX_LENGTH))}
            />
            <button
              type="submit"
              disabled={disabled || !text.trim()}
              className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900 hover:bg-amber-200 disabled:opacity-50"
            >
              {retryable ? t.common.retry : t.play.ask}
            </button>
          </div>
          <p className="flex justify-between gap-2 text-xs text-stone-500">
            <span>{t.play.negationTip}</span>
            <span>{t.play.lengthHint(text.trim().length, QUESTION_MAX_LENGTH)}</span>
          </p>
        </form>
      )}
    </section>
  );
}
