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
  large = false,
}: {
  disabled: boolean;
  onText: (text: string) => void;
  /** 입력 상자 옆의 큰 상자 모양(아이콘 + 글자) */
  large?: boolean;
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
    <div className="relative h-full">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={large ? undefined : listening ? t.mic.stop : t.mic.start}
        className={`h-full rounded ${large ? 'flex w-24 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-semibold' : 'px-3 py-2'} ${listening ? 'animate-pulse bg-stamp text-cream' : 'border border-line-strong bg-paper-2 text-ink hover:bg-paper-3'} disabled:opacity-50`}
      >
        <span aria-hidden={large || undefined} className={large ? 'text-lg' : undefined}>
          🎤
        </span>
        {large && <span>{listening ? t.mic.stop : t.mic.start}</span>}
      </button>
      {notice && (
        <div
          role="dialog"
          aria-label={t.mic.noticeTitle}
          className="paper absolute right-0 bottom-full z-10 mb-2 w-72 p-3 text-sm"
        >
          <p className="font-semibold text-ink">{t.mic.noticeTitle}</p>
          <p className="mt-1 text-ink-2">{t.mic.noticeBody}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNotice(false)}
              className="btn btn-ghost px-3 py-1"
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
              className="btn btn-primary px-3 py-1"
            >
              {t.mic.noticeOk}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="absolute right-0 top-full mt-1 w-56 text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
