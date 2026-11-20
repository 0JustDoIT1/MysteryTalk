'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDeviceHydrated, useDeviceStore } from '@/stores/device';
import { t } from '@/i18n/ko';

/**
 * 18세 확인(PRD D33, SPEC §3.4): 기기당 처음 한 번 묻고 결과를 기억한다.
 * '만 18세 이상입니다'에 체크해야만 확인 버튼이 켜지고, 확인 전에는 창 밖을 누를 수 없다(포인터도 금지 표시).
 * '아니요' 버튼과 차단 화면은 두지 않는다(2026-11-20, D60 변경): 잘못 눌러 되돌릴 수 없게 되는 일을 없앤다.
 * 예전에 '아니요'를 저장한 기기도 다시 묻는다. 연령 검증 수준은 법률 검토 대상(docs/LEGAL_REVIEW.md).
 */
export function AgeGate({ children }: { children: ReactNode }) {
  const { age, setAge } = useDeviceStore();
  const hydrated = useDeviceHydrated();
  const ref = useRef<HTMLDialogElement>(null);
  const [checked, setChecked] = useState(false);
  const ask = hydrated && age !== 'yes';

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ask && !d.open) d.showModal();
    if (!ask && d.open) d.close();
  }, [ask]);

  return (
    <>
      {children}
      <dialog
        ref={ref}
        aria-labelledby="age-heading"
        aria-describedby="age-body"
        // Esc로 닫지 못하게 한다(확인해야만 넘어간다)
        onCancel={(e) => e.preventDefault()}
        className="paper m-auto w-[min(28rem,92vw)] p-6 backdrop:cursor-not-allowed backdrop:bg-black/90"
      >
        <h2 id="age-heading" className="text-xl font-bold text-ink">
          {t.age.title}
        </h2>
        <p id="age-body" className="mt-2 text-sm leading-relaxed text-ink-2">
          {t.age.body}
        </p>
        <label className="paper-inset mt-5 flex cursor-pointer items-center gap-3 px-4 py-3.5 font-semibold text-ink">
          <input
            type="checkbox"
            autoFocus
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer"
          />
          {t.age.check}
        </label>
        <button
          type="button"
          disabled={!checked}
          onClick={() => setAge('yes')}
          className="btn btn-primary mt-4 w-full py-3"
        >
          {t.age.confirm}
        </button>
        <p className="mt-4 text-center text-xs text-ink-3">
          {t.age.legalBefore}
          <Link href="/terms" target="_blank" className="link">
            {t.age.terms}
          </Link>
          {t.age.legalAnd}
          <Link href="/privacy" target="_blank" className="link">
            {t.age.privacy}
          </Link>
          {t.age.legalAfter}
        </p>
      </dialog>
    </>
  );
}
