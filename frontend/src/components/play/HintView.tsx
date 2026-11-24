'use client';

import { useId } from 'react';
import type { HintState } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';
import { hintImageUrl } from './CaseImage';
import { Modal } from './Dialogs';

/**
 * 방금 연 힌트를 크게 보여 주는 창(2026-11-24, PRD D109). 그림 힌트는 큰 그림, 글 힌트는 큰 글.
 * 닫으면 수첩의 힌트 탭에 남는다(그곳에서도 눌러서 다시 크게 볼 수 있다).
 */
export function HintModal({
  sessionId,
  hint,
  onClose,
}: {
  sessionId: string;
  hint: HintState | null;
  onClose: () => void;
}) {
  const headingId = useId();
  return (
    <Modal open={hint !== null} onClose={onClose} labelledBy={headingId}>
      {/* 내용은 열 때만 만든다(닫힌 동안 큰 이미지가 숨은 채 남지 않게) */}
      {hint && (
        <>
          <h2 id={headingId} className="label mb-3">
            {t.hints.label(hint.no)}
          </h2>
          {hint.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- 세션 인증이 필요한 동적 이미지라 최적화 대상이 아니다
            <img
              src={hintImageUrl(sessionId, hint.no)}
              alt={hint.alt ?? ''}
              className="max-h-[70vh] w-full rounded object-contain"
            />
          ) : (
            <p className="paper-inset px-4 py-3 text-base leading-relaxed text-ink">{hint.text}</p>
          )}
          <p className="mt-3 text-sm text-ink-3">{t.hints.savedNote}</p>
          <form method="dialog" className="mt-3 flex justify-end">
            <button type="submit" autoFocus className="btn btn-primary">
              {t.common.close}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
