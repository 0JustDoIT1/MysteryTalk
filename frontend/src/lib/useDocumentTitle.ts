'use client';

import { useEffect } from 'react';
import { t } from '@/i18n/ko';

/**
 * 데이터를 받아 와야 제목을 알 수 있는 화면(사건 소개·추리·엔딩)의 브라우저 탭 제목.
 * 정적 화면은 각 page.tsx의 metadata(레이아웃의 '%s · MysteryTalk' 템플릿)를 쓴다.
 * 화면 낭독기 사용자와 탭을 여러 개 연 사용자가 지금 화면을 알 수 있게 한다(PRD D66).
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${t.app.title}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
