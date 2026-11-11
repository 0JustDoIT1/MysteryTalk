'use client';

import { useEffect, useRef } from 'react';
import { useDeviceStore } from '@/stores/device';

/**
 * 배경음악(PRD D39). 음악 파일은 에셋을 정할 때 넣는다(6단계 결정). 그 전까지는 아무것도 재생하지 않는다.
 * 파일을 넣으면 BGM_SRC 만 바꾸면 되고, 볼륨은 설정의 배경음악 값을 따른다.
 * 브라우저 자동 재생 제한 때문에 첫 클릭·키 입력 뒤에 재생을 시작한다.
 */
export const BGM_SRC: string | null = null;

export function BgmPlayer() {
  const volume = useDeviceStore((s) => s.bgm);
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!BGM_SRC) return;
    const start = () => void ref.current?.play().catch(() => undefined);
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);

  if (!BGM_SRC) return null;
  return <audio ref={ref} src={BGM_SRC} loop preload="none" />;
}
