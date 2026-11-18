import type { Genre } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';

/** 장르별 임시 그림 색(대표 그림이 생기기 전까지, PRD D98) */
const GENRE_BG: Record<Genre, string> = {
  MYSTERY: 'from-indigo-950 via-slate-900 to-stone-950',
  HORROR: 'from-rose-950 via-stone-900 to-stone-950',
  CRIME: 'from-amber-950 via-stone-900 to-stone-950',
};

/** 사건 카드의 대표 그림 자리. 지금은 장르 색 + 사건 번호로 된 임시 그림이다. 장식이라 화면 낭독에서 뺀다. */
export function CaseArt({
  caseNo,
  isTutorial,
  genre,
}: {
  caseNo: number;
  isTutorial: boolean;
  genre: Genre | undefined;
}) {
  const label = isTutorial
    ? t.cases.tutorialBadge
    : caseNo > 0
      ? t.cases.caseNo(caseNo)
      : t.cases.sample;
  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[16/9] items-center justify-center rounded-md bg-gradient-to-br ${GENRE_BG[genre ?? 'MYSTERY']}`}
    >
      <span className="font-mono text-2xl font-bold tracking-widest text-stone-300/70">
        {label}
      </span>
    </div>
  );
}
