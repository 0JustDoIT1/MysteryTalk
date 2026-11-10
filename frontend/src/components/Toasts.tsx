'use client';

import { useEffect } from 'react';
import { t } from '@/i18n/ko';
import { useToastStore } from '@/stores/toast';

/** 화면 아래 알림. 화면 낭독기에도 읽힌다(D66). */
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => dismiss(toasts[0]!.id), 4000);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-md border border-amber-400/40 bg-stone-900 px-4 py-2 text-sm text-amber-100 shadow-lg"
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="text-amber-300 underline-offset-2 hover:underline"
          >
            {t.common.close}
          </button>
        </div>
      ))}
    </div>
  );
}
