import type { CaseSummary, Genre } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';

export const GENRES_WITH_ALL = ['ALL', 'MYSTERY', 'HORROR', 'CRIME'] as const;
export type GenreFilter = (typeof GENRES_WITH_ALL)[number];

/** 장르 필터(PRD D50). 사건은 장르를 여러 개 가질 수 있다. 목록 순서는 서버 순서(튜토리얼 → 쉬운 순)를 따른다. */
export function filterByGenre(cases: CaseSummary[], genre: GenreFilter): CaseSummary[] {
  return genre === 'ALL' ? cases : cases.filter((c) => c.genres.includes(genre as Genre));
}

/**
 * 사건 카드·소개·추리 화면의 번호 표시. 튜토리얼은 '튜토리얼', 본편은 '사건 01'.
 * 번호가 없는(0) 사건은 표시하지 않는다('샘플' 같은 내부 구분은 이용자에게 보이지 않게, 2026-11-20).
 */
export function caseLabel(c: { isTutorial: boolean; caseNo: number }): string | null {
  if (c.isTutorial) return t.cases.tutorialBadge;
  return c.caseNo > 0 ? t.cases.caseNo(c.caseNo) : null;
}
