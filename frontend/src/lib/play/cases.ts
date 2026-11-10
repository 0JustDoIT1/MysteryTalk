import type { CaseSummary, Genre } from '@mysterytalk/shared';

export const GENRES_WITH_ALL = ['ALL', 'MYSTERY', 'HORROR', 'CRIME'] as const;
export type GenreFilter = (typeof GENRES_WITH_ALL)[number];

/** 장르 필터(PRD D50). 사건은 장르를 여러 개 가질 수 있다. 목록 순서는 서버 순서(튜토리얼 → 쉬운 순)를 따른다. */
export function filterByGenre(cases: CaseSummary[], genre: GenreFilter): CaseSummary[] {
  return genre === 'ALL' ? cases : cases.filter((c) => c.genres.includes(genre as Genre));
}
