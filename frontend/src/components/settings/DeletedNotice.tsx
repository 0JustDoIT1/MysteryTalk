'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useToastStore } from '@/stores/toast';
import { t } from '@/i18n/ko';

/** 기록을 지우고 첫 화면을 새로 연 뒤(?deleted=1) 한 번 알리고 주소에서 표시를 지운다(PRD D95·D96). */
export function DeletedNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pushToast = useToastStore((s) => s.push);
  const deleted = params.get('deleted') === '1';
  // 개발 모드에서 효과가 두 번 실행돼도 한 번만 알린다
  const shown = useRef(false);
  useEffect(() => {
    if (!deleted || shown.current) return;
    shown.current = true;
    pushToast(t.settings.deleted);
    router.replace('/', { scroll: false });
  }, [deleted, pushToast, router]);
  return null;
}
