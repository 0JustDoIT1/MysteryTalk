import { toast } from 'sonner';
import { create } from 'zustand';

/**
 * 알림(토스트) 보내기(SPEC §12.1). 표시·자동 닫힘·쌓임은 sonner가 맡는다(components/Toasts.tsx).
 * 호출하는 쪽은 `useToastStore((s) => s.push)`만 쓴다. 서버 데이터는 두지 않는다.
 */
type ToastState = { push: (text: string) => void };

export const useToastStore = create<ToastState>(() => ({
  push: (text) => {
    toast(text);
  },
}));
