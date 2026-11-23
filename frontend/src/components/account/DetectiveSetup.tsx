'use client';

import { useEffect, useRef } from 'react';
import { useMe } from '@/lib/api/queries';
import { useDeviceHydrated, useDeviceStore } from '@/stores/device';
import { DetectivePicker } from './DetectivePicker';
import { t } from '@/i18n/ko';

/**
 * '탐정 정하기' 창(PRD D103): 연령 확인을 마친 기기에서, 아직 캐릭터를 고르지 않은 플레이어에게 처음 한 번만 띄운다.
 * 고르거나 '나중에 할게요'를 누르면 이 기기에서는 다시 띄우지 않는다(설정에서 바꿀 수 있음).
 */
export function DetectiveSetup() {
  const hydrated = useDeviceHydrated();
  const { age, detectiveAsked, setDetectiveAsked } = useDeviceStore();
  // 창을 띄울 수 있는 기기에서만 불러온다. 레이아웃에서 늘 불러오면 다른 화면이 서버 화면을 이어받기 전에
  // 정보가 먼저 도착해 하이드레이션 불일치가 난다.
  const me = useMe(hydrated && age === 'yes' && !detectiveAsked);
  const ref = useRef<HTMLDialogElement>(null);
  const show =
    hydrated &&
    age === 'yes' &&
    !detectiveAsked &&
    !!me.data &&
    me.data.detectiveCharacter === null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (show && !d.open) d.showModal();
    if (!show && d.open) d.close();
  }, [show]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="detective-setup-heading"
      onCancel={(e) => {
        e.preventDefault();
        setDetectiveAsked();
      }}
      // Esc가 막히지 않고 창이 그냥 닫힌 경우(최신 크롬)도 '나중에 할게요'로 본다
      onClose={() => {
        if (show) setDetectiveAsked();
      }}
      className="paper m-auto w-[min(40rem,94vw)] p-6 backdrop:bg-black/80"
    >
      <h2
        id="detective-setup-heading"
        className="border-b-2 border-ink/70 pb-2 text-xl font-bold text-ink"
      >
        {t.detective.setupTitle}
      </h2>
      <p className="mt-2 text-sm text-ink-2">{t.detective.setupBody}</p>
      <div className="mt-4">
        {show && me.data && (
          <DetectivePicker
            name={me.data.detectiveName}
            character={me.data.detectiveCharacter}
            submitLabel={t.detective.start}
            onSaved={setDetectiveAsked}
          />
        )}
      </div>
      <button type="button" onClick={setDetectiveAsked} className="link mt-3 text-sm">
        {t.detective.skip}
      </button>
    </dialog>
  );
}
