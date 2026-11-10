import type { Position } from '@mysterytalk/shared';
import { create } from 'zustand';
import type { Dir } from '@/lib/play/explore';

/**
 * 전역 상태(SPEC §12.1): Phaser ↔ React 신호.
 * - live: 걷는 중인 현재 위치(서버에는 이동·조사 시와 주기적으로 저장된다. 원본 위치는 서버 상태)
 * - command: Phaser가 넣는 요청(조사·맵 이동). React가 꺼내 API를 호출한다.
 * - locked: 조사 창이 열려 있거나 요청 중이면 이동을 멈춘다.
 */
export type ExploreCommand =
  { type: 'inspect'; target: string; at: Position } | { type: 'travel'; to: Position };

type ExploreStore = {
  live: Position | null;
  facing: Dir;
  command: ExploreCommand | null;
  locked: boolean;
  setLive: (p: Position, facing?: Dir) => void;
  send: (c: ExploreCommand) => void;
  take: () => ExploreCommand | null;
  setLocked: (v: boolean) => void;
  reset: () => void;
};

export const useExploreStore = create<ExploreStore>((set, get) => ({
  live: null,
  facing: 'down',
  command: null,
  locked: false,
  setLive: (p, facing) => set((s) => ({ live: p, facing: facing ?? s.facing })),
  send: (c) => set({ command: c }),
  take: () => {
    const c = get().command;
    if (c) set({ command: null });
    return c;
  },
  setLocked: (v) => set({ locked: v }),
  reset: () => set({ live: null, facing: 'down', command: null, locked: false }),
}));
