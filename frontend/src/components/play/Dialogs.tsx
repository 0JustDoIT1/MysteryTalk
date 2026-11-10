'use client';

import { ANSWER_MAX_LENGTH, ANSWER_MIN_LENGTH, type SessionState } from '@mysterytalk/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isRetryable } from '@/lib/api/client';
import { useAbandon, useSubmitAnswer } from '@/lib/api/queries';
import { keyFor, type PendingRequest } from '@/lib/play/idempotency';
import { t } from '@/i18n/ko';

/** 네이티브 <dialog> 모달: 포커스 가두기·ESC 닫기를 브라우저가 처리한다(D66 키보드 조작). */
function Modal({
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
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // 화면을 떠나거나(이전 화면이 숨겨진 채 보존될 때 포함) 사라지면 닫는다.
    // 열린 모달이 최상위 레이어에 남으면 다음 화면의 클릭을 막는다.
    return () => {
      if (d.open) d.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      className="m-auto w-[min(36rem,92vw)] rounded-lg border border-stone-600 bg-stone-900 p-5 text-stone-100 backdrop:bg-black/70"
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
        <h2 id="submit-heading" className="text-lg font-semibold text-amber-200">
          {t.submit.heading}
        </h2>
        <label htmlFor="answer" className="text-sm text-stone-300">
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
          className="rounded border border-stone-600 bg-stone-950 p-2"
        />
        <p className="flex justify-between text-xs text-stone-400">
          <span>{t.submit.confirmNote(session.submissionsLeft)}</span>
          <span>{t.play.lengthHint(length, ANSWER_MAX_LENGTH)}</span>
        </p>
        <div aria-live="polite" className="text-sm">
          {submit.isPending && <p className="animate-pulse text-stone-300">{t.submit.grading}</p>}
          {result?.result === 'WRONG' && result.totalCount !== null && (
            <p className="text-rose-200">
              {t.submit.wrong(result.matchedCount ?? 0, result.totalCount)}{' '}
              {t.play.submissionsLeft(result.submissionsLeft)}
            </p>
          )}
          {result?.result === 'NEEDS_DETAIL' && (
            <p className="text-sky-200">
              {result.detailReason === 'FORM' ? t.submit.needsForm : t.submit.needsDetail}
            </p>
          )}
          {result?.result === 'SOLVED' && <p className="text-emerald-200">{t.submit.solved}</p>}
          {submit.error && (
            <p role="alert" className="text-red-300">
              {submit.error.message}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-stone-300 hover:bg-stone-800"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={!valid || submit.isPending}
            className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900 hover:bg-amber-200 disabled:opacity-50"
          >
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
        <h2 id="abandon-heading" className="text-lg font-semibold text-rose-200">
          {t.abandon.heading}
        </h2>
        <p className="text-sm text-stone-300">{t.abandon.body}</p>
        {abandon.error && (
          <p role="alert" className="text-sm text-red-300">
            {abandon.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-stone-300 hover:bg-stone-800"
          >
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
            className="rounded bg-rose-400 px-4 py-2 font-semibold text-stone-900 hover:bg-rose-300 disabled:opacity-50"
          >
            {t.abandon.confirm}
          </button>
        </div>
      </div>
    </Modal>
  );
}
