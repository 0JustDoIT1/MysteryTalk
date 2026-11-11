'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRecognition, speechSupported, transcriptOf, type Recognition } from '@/lib/speech';
import { useDeviceStore } from '@/stores/device';
import { t } from '@/i18n/ko';

const noop = () => () => undefined;

/**
 * 마이크로 질문하기(PRD D38): 지원하는 브라우저에서만 보인다(서버 렌더에서는 숨김).
 * 인식한 문장은 입력창에만 넣고, 보내기는 플레이어가 확인한 뒤 직접 한다.
 * 처음 쓸 때 '음성이 브라우저 제조사 서버에서 처리될 수 있음'을 안내한다.
 */
export function MicButton({
  disabled,
  onText,
}: {
  disabled: boolean;
  onText: (text: string) => void;
}) {
  const supported = useSyncExternalStore(noop, speechSupported, () => false);
  const { micNoticeSeen, setMicNoticeSeen } = useDeviceStore();
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  if (!supported) return null;

  function listen() {
    setError(null);
    const r = createRecognition();
    if (!r) return;
    rec.current = r;
    r.onresult = (e) => {
      const text = transcriptOf(e);
      if (text) onText(text);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') setError(t.mic.error);
    };
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }

  function onClick() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    if (!micNoticeSeen) {
      setNotice(true);
      return;
    }
    listen();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? t.mic.stop : t.mic.start}
        className={`h-full rounded px-3 py-2 ${listening ? 'animate-pulse bg-rose-400 text-stone-900' : 'bg-stone-700 text-stone-100 hover:bg-stone-600'} disabled:opacity-50`}
      >
        🎤
      </button>
      {notice && (
        <div
          role="dialog"
          aria-label={t.mic.noticeTitle}
          className="absolute right-0 bottom-full z-10 mb-2 w-72 rounded-lg border border-stone-600 bg-stone-900 p-3 text-sm shadow-lg"
        >
          <p className="font-semibold text-amber-200">{t.mic.noticeTitle}</p>
          <p className="mt-1 text-stone-300">{t.mic.noticeBody}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNotice(false)}
              className="rounded px-3 py-1 text-stone-300 hover:bg-stone-800"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setMicNoticeSeen();
                setNotice(false);
                listen();
              }}
              className="rounded bg-amber-300 px-3 py-1 font-semibold text-stone-900"
            >
              {t.mic.noticeOk}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="absolute right-0 top-full mt-1 w-56 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
