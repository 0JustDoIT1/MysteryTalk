import type { Genre } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';

/** 장르별 임시 그림 색(대표 그림이 없는 사건, PRD D98) */
const GENRE_BG: Record<Genre, string> = {
  MYSTERY: 'from-indigo-950 via-slate-900 to-stone-950',
  HORROR: 'from-rose-950 via-stone-900 to-stone-950',
  CRIME: 'from-amber-950 via-stone-900 to-stone-950',
};

/** 대표 그림 주소. 사건 버전을 붙여 그림이 바뀌면 브라우저가 새로 받는다 */
export const coverImageUrl = (slug: string, version: number) =>
  `/api/cases/${slug}/cover?v=${version}`;

/**
 * 사건 카드·소개 화면의 대표 그림(D98). 그림이 있으면 그 그림, 없으면 장르 색 + 사건 번호 임시 그림.
 * 제목이 바로 옆에 있어 장식으로 보고 화면 낭독에서 뺀다.
 */
export function CaseArt({
  slug,
  caseNo,
  isTutorial,
  genre,
  coverVersion,
}: {
  slug: string;
  caseNo: number;
  isTutorial: boolean;
  genre: Genre | undefined;
  coverVersion: number | null;
}) {
  if (coverVersion !== null)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- API가 주는 사건 그림이라 next/image 최적화를 쓰지 않는다
      <img
        src={coverImageUrl(slug, coverVersion)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="aspect-[16/9] w-full object-cover sepia-[.15] [image-rendering:pixelated]"
      />
    );
  const label = isTutorial
    ? t.cases.tutorialBadge
    : caseNo > 0
      ? t.cases.caseNo(caseNo)
      : t.cases.sample;
  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[16/9] items-center justify-center bg-gradient-to-br ${GENRE_BG[genre ?? 'MYSTERY']}`}
    >
      <span className="font-mono text-2xl font-bold tracking-widest text-cream/70">{label}</span>
    </div>
  );
}
