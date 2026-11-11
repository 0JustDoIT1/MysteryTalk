import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 기기 단위 정보(SPEC §12.1-4): 브라우저에 오래 남길 것만 둔다. 진행 기록은 서버에 있다.
 * - age: 18세 확인 결과와 시각(PRD D33·D60). 'no'면 차단 화면만 보여 준다.
 * - bgm·sfx: 배경음악·효과음 볼륨 0~100(PRD D39). 기기마다 따로 둔다.
 * - micNoticeSeen: 음성 입력 안내(브라우저 제조사가 음성을 처리할 수 있음, D38)를 본 적이 있는지
 * 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 화면은 동작해야 하므로 실패를 삼킨다.
 */
type DeviceState = {
  age: 'yes' | 'no' | null;
  ageAt: string | null;
  bgm: number;
  sfx: number;
  micNoticeSeen: boolean;
  setAge: (v: 'yes' | 'no') => void;
  setBgm: (v: number) => void;
  setSfx: (v: number) => void;
  setMicNoticeSeen: () => void;
};

const clampVolume = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 저장 실패는 무시(이번 방문 동안만 유지) */
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* 무시 */
    }
  },
}));

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      age: null,
      ageAt: null,
      bgm: 60,
      sfx: 80,
      micNoticeSeen: false,
      setAge: (v) => set({ age: v, ageAt: new Date().toISOString() }),
      setBgm: (v) => set({ bgm: clampVolume(v) }),
      setSfx: (v) => set({ sfx: clampVolume(v) }),
      setMicNoticeSeen: () => set({ micNoticeSeen: true }),
    }),
    {
      name: 'mt-device',
      storage: safeStorage,
      partialize: (s) => ({
        age: s.age,
        ageAt: s.ageAt,
        bgm: s.bgm,
        sfx: s.sfx,
        micNoticeSeen: s.micNoticeSeen,
      }),
    },
  ),
);

/**
 * 저장소에서 복원이 끝났는지. 서버 렌더와 첫 화면에서는 false라 화면이 어긋나지 않는다.
 */
export function useDeviceHydrated(): boolean {
  return useSyncExternalStore(
    (notify) => useDeviceStore.persist.onFinishHydration(notify),
    () => useDeviceStore.persist.hasHydrated(),
    () => false,
  );
}
