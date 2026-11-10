import { create } from 'zustand';

/**
 * 전역 상태(SPEC §12.1): 알림(토스트) 대기열. 서버 데이터는 두지 않는다.
 */
export type Toast = { id: number; text: string };

type ToastState = {
  toasts: Toast[];
  push: (text: string) => void;
  dismiss: (id: number) => void;
};

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (text) => set((s) => ({ toasts: [...s.toasts, { id: (seq += 1), text }].slice(-3) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
