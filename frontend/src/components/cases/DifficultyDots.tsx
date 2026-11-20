import type { Difficulty } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';

const LEVEL: Record<Difficulty, number> = { EASY: 1, NORMAL: 2, HARD: 3 };
const DOT: Record<Difficulty, string> = { EASY: 'bg-ok', NORMAL: 'bg-info', HARD: 'bg-bad' };

/** 난이도를 점 세 개로(쉬움 ●○○, 보통 ●●○, 어려움 ●●●). 화면 낭독기에는 '난이도 쉬움'처럼 읽힌다. */
export function DifficultyDots({ difficulty }: { difficulty: Difficulty }) {
  const filled = LEVEL[difficulty];
  return (
    <span className="chip gap-1.5">
      <span aria-hidden="true">{t.difficulty.label}</span>
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i <= filled ? DOT[difficulty] : 'bg-line'}`}
          />
        ))}
      </span>
      <span className="sr-only">
        {t.difficulty.label} {t.difficulty[difficulty]}
      </span>
    </span>
  );
}
