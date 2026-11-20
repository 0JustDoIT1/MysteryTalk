'use client';

import { Toaster } from 'sonner';
import { t } from '@/i18n/ko';

/**
 * 화면 아래 알림(sonner). 2.5초 뒤 저절로 닫히고, 마우스를 올리면 멈추며, 밀어서 닫을 수도 있다.
 * 알림 영역은 aria-live라 화면 낭독기가 읽는다(PRD D66). 닫기 버튼도 둔다(키보드 사용자).
 */
export function Toasts() {
  return (
    <Toaster
      position="bottom-center"
      duration={2500}
      visibleToasts={3}
      closeButton
      containerAriaLabel={t.common.notifications}
      toastOptions={{
        closeButtonAriaLabel: t.common.close,
        className: 'font-sans',
      }}
      style={
        {
          '--normal-bg': 'var(--color-paper)',
          '--normal-text': 'var(--color-ink)',
          '--normal-border': 'var(--color-line-strong)',
        } as React.CSSProperties
      }
    />
  );
}
