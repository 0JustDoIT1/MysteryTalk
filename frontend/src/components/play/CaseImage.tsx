'use client';

import { useId, useState } from 'react';
import { t } from '@/i18n/ko';
import { Modal } from './Dialogs';

/**
 * 힌트·단서 이미지(PRD D92·D93): 썸네일을 누르면 확대해 본다.
 * 이미지는 서버가 열람·획득한 세션에만 내려준다(같은 출처 쿠키로 요청).
 * 대체 텍스트는 화면 낭독기만 읽고 화면에는 보이지 않는다.
 */
export function CaseImage({ src, alt, label }: { src: string; alt: string; label: string }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.image.zoom(label)}
        className="photo block w-fit p-1 hover:outline-2 hover:outline-gold"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 세션 인증이 필요한 동적 이미지라 최적화 대상이 아니다 */}
        <img src={src} alt={alt} className="h-24 w-36 object-cover" />
        <span aria-hidden="true" className="block pt-1 text-center text-xs text-ink-3">
          {t.image.zoomCue}
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        {/* 내용은 열 때만 만든다(닫힌 동안 같은 제목·큰 이미지가 숨은 채 겹쳐 있지 않게) */}
        {open && (
          <>
            <h2 id={headingId} className="label mb-3">
              {label}
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같음 */}
            <img src={src} alt={alt} className="max-h-[70vh] w-full rounded object-contain" />
            <form method="dialog" className="mt-3 flex justify-end">
              <button type="submit" autoFocus className="btn btn-primary">
                {t.common.close}
              </button>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}

export const hintImageUrl = (sessionId: string, no: number) =>
  `/api/sessions/${sessionId}/hints/${no}/image`;
export const clueImageUrl = (sessionId: string, key: string) =>
  `/api/sessions/${sessionId}/clues/${key}/image`;
