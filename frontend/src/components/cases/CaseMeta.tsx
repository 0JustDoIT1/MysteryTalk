import type { Difficulty, Genre } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';

/** 사건 정보 한 줄(PRD D99): 장르·난이도·기준/최대 질문 수·정답 요소 개수(D100) */
export function CaseMeta({
  genres,
  difficulty,
  baseQuestions,
  maxQuestions,
  elementCount,
}: {
  genres: Genre[];
  difficulty: Difficulty;
  baseQuestions: number;
  maxQuestions: number;
  elementCount: number;
}) {
  const items = [
    genres.map((g) => t.genre[g]).join('·'),
    t.difficulty[difficulty],
    t.caseMeta.questions(baseQuestions, maxQuestions),
    t.caseMeta.elements(elementCount),
  ];
  return (
    <ul aria-label={t.caseMeta.label} className="flex flex-wrap gap-1.5 text-xs">
      {items.map((item) => (
        <li key={item} className="rounded bg-stone-800 px-2 py-0.5 text-stone-200">
          {item}
        </li>
      ))}
    </ul>
  );
}
