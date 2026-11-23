'use client';

import { ANSWER_MAX_LENGTH, ANSWER_MIN_LENGTH, type SessionState } from '@mysterytalk/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isRetryable } from '@/lib/api/client';
import { useAbandon, useSubmitAnswer } from '@/lib/api/queries';
import { useSfx } from '@/lib/audio/use-sfx';
import { keyFor, type PendingRequest } from '@/lib/play/idempotency';
import { submitErrorMessage } from '@/lib/play/submit-error';
import { t } from '@/i18n/ko';

/** 네이티브 <dialog> 모달: 포커스 가두기·ESC 닫기를 브라우저가 처리한다(D66 키보드 조작). */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // 코드가 닫은 경우(화면 정리·개발 모드의 효과 재실행)는 사용자가 닫은 것으로 보지 않는다.
  // 그렇지 않으면 처음부터 열린 모달이 개발 모드에서 곧바로 onClose 를 부른다.
  const closingByCode = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      closingByCode.current = true;
      d.close();
    }
    // 화면을 떠나거나(이전 화면이 숨겨진 채 보존될 때 포함) 사라지면 닫는다.
    // 열린 모달이 최상위 레이어에 남으면 다음 화면의 클릭을 막는다.
    return () => {
      if (d.open) {
        closingByCode.current = true;
        d.close();
      }
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={() => {
        if (closingByCode.current) {
          closingByCode.current = false;
          return;
        }
        onClose();
      }}
      className="paper m-auto w-[min(36rem,92vw)] p-5 backdrop:bg-black/70 sm:p-6"
    >
      {children}
    </dialog>
  );
}

/** 정답 제출(SPEC §7, PRD D71·D79·D21·D23): 자유 서술 10~300자, 확인 후 제출, 결과 안내. */
export function SubmitDialog({
  session,
  open,
  onClose,
}: {
  session: SessionState;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const submit = useSubmitAnswer(session.sessionId);
  const play = useSfx();
  const length = answer.trim().length;
  const valid = length >= ANSWER_MIN_LENGTH && length <= ANSWER_MAX_LENGTH;
  const result = submit.data;

  function send() {
    const text = answer.trim();
    if (!valid || submit.isPending) return;
    const request = keyFor(pending, text);
    setPending(request);
    submit.mutate(
      { answer: text, key: request.key },
      {
        onSuccess: (r) => {
          setPending(null);
          if (r.result === 'SOLVED') play('solved');
          else if (r.result === 'WRONG') play('wrong');
          else play('RETRY');
          if (r.status !== 'ACTIVE') router.push(`/play/${session.sessionId}/ending`);
        },
        onError: (error) => {
          if (!isRetryable(error)) setPending(null);
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="submit-heading">
      <form
        method="dialog"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <h2
          id="submit-heading"
          className="border-b-2 border-ink/70 pb-2 text-xl font-bold text-ink"
        >
          {t.submit.heading}
        </h2>
        <label htmlFor="answer" className="text-sm text-ink-2">
          {t.submit.label}
        </label>
        <textarea
          id="answer"
          value={answer}
          maxLength={ANSWER_MAX_LENGTH}
          onChange={(e) => setAnswer(e.target.value)}
          rows={6}
          disabled={submit.isPending}
          placeholder={t.submit.placeholder}
          className="field"
        />
        <p className="flex justify-between text-xs text-ink-3">
          <span>{t.submit.confirmNote(session.submissionsLeft)}</span>
          <span>{t.play.lengthHint(length, ANSWER_MAX_LENGTH)}</span>
        </p>
        <div aria-live="polite" className="text-sm">
          {submit.isPending && <p className="animate-pulse text-ink-2">{t.submit.grading}</p>}
          {result?.result === 'WRONG' && result.totalCount !== null && (
            <p className="text-bad">
              {t.submit.wrong(result.matchedCount ?? 0, result.totalCount)}{' '}
              {t.play.submissionsLeft(result.submissionsLeft)}
            </p>
          )}
          {result?.result === 'NEEDS_DETAIL' && (
            <p className="text-info">
              {result.detailReason === 'FORM' ? t.submit.needsForm : t.submit.needsDetail}
            </p>
          )}
          {result?.result === 'SOLVED' && <p className="text-ok">{t.submit.solved}</p>}
          {submit.error && (
            <p role="alert" className="text-bad">
              {submitErrorMessage(submit.error)}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={!valid || submit.isPending} className="btn btn-primary">
            {submit.error && isRetryable(submit.error) ? t.common.retry : t.submit.confirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** 수사 포기(PRD D80): 확인 창 후 F 기록, 엔딩으로 이동 */
export function AbandonDialog({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const abandon = useAbandon(sessionId);
  return (
    <Modal open={open} onClose={onClose} labelledBy="abandon-heading">
      <div className="flex flex-col gap-3">
        <h2
          id="abandon-heading"
          className="border-b-2 border-bad/70 pb-2 text-xl font-bold text-bad"
        >
          {t.abandon.heading}
        </h2>
        <p className="text-sm text-ink-2">{t.abandon.body}</p>
        {abandon.error && (
          <p role="alert" className="text-sm text-bad">
            {abandon.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={abandon.isPending}
            onClick={() =>
              abandon.mutate(undefined, {
                onSuccess: () => router.push(`/play/${sessionId}/ending`),
              })
            }
            className="btn btn-danger"
          >
            {t.abandon.confirm}
          </button>
        </div>
      </div>
    </Modal>
  );
}
