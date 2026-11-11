'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { useDeviceHydrated, useDeviceStore } from '@/stores/device';
import { t } from '@/i18n/ko';

/**
 * 18세 확인(PRD D33·D60, SPEC §3.4): 기기당 처음 한 번 묻고 결과를 기억한다.
 * '아니오'면 이용 불가 화면만 보여 준다(완전한 차단은 아니며 연령 검증 수준은 법률 검토 대상).
 */
export function AgeGate({ children }: { children: ReactNode }) {
  const { age, setAge } = useDeviceStore();
  const hydrated = useDeviceHydrated();
  const ref = useRef<HTMLDialogElement>(null);
  const ask = hydrated && age === null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ask && !d.open) d.showModal();
    if (!ask && d.open) d.close();
  }, [ask]);

  if (hydrated && age === 'no') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-amber-200">{t.age.blockedTitle}</h1>
        <p className="text-stone-300">{t.age.blockedBody}</p>
      </main>
    );
  }

  return (
    <>
      {children}
      <dialog
        ref={ref}
        aria-labelledby="age-heading"
        onCancel={(e) => e.preventDefault()}
        className="m-auto w-[min(28rem,92vw)] rounded-lg border border-stone-600 bg-stone-900 p-6 text-stone-100 backdrop:bg-black/90"
      >
        <h2 id="age-heading" className="text-xl font-bold text-amber-200">
          {t.age.title}
        </h2>
        <p className="mt-3 text-sm text-stone-300">{t.age.body}</p>
        <p className="mt-3 text-xs text-stone-400">
          <Link href="/terms" target="_blank" className="underline">
            {t.age.terms}
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" target="_blank" className="underline">
            {t.age.privacy}
          </Link>
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setAge('no')}
            className="rounded px-4 py-2 text-stone-300 hover:bg-stone-800"
          >
            {t.age.no}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => setAge('yes')}
            className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900 hover:bg-amber-200"
          >
            {t.age.yes}
          </button>
        </div>
      </dialog>
    </>
  );
}
