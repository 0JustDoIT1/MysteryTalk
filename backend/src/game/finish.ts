import type { Grade } from '@mysterytalk/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { computeScore, isBetter, solvedGrade } from './scoring.js';

export type FinishInput = {
  sessionId: string;
  playerId: string;
  caseId: string;
  isTutorial: boolean;
  playNo: number;
  status: 'SOLVED' | 'PARTIAL' | 'FAILED' | 'ABANDONED';
  baseQuestions: number;
  questionsUsed: number;
  wrongSubmissions: number;
};

/**
 * 세션 종료(트랜잭션 안에서 호출). 점수·등급 계산 → 세션 확정 → 개인 기록 갱신(SPEC §7-8, §8).
 * 점수는 해결(SOLVED)일 때만 매긴다. 부분 해결은 D, 미해결·포기는 F(PRD D14, D69, D80).
 * 튜토리얼은 점수·등급을 계산해 보여 주되 개인 기록에는 반영하지 않는다(PRD v1.3, D24).
 */
export async function finishSession(
  tx: Prisma.TransactionClient,
  input: FinishInput,
): Promise<{ grade: Grade; score: number | null }> {
  const hintsViewed = await tx.hintView.count({ where: { sessionId: input.sessionId } });
  const { score: rawScore } = computeScore({
    baseQuestions: input.baseQuestions,
    questionsUsed: input.questionsUsed,
    hintsViewed,
    wrongSubmissions: input.wrongSubmissions,
  });
  const score = input.status === 'SOLVED' ? rawScore : null;
  const grade: Grade =
    input.status === 'SOLVED' ? solvedGrade(rawScore) : input.status === 'PARTIAL' ? 'D' : 'F';

  await tx.playSession.update({
    where: { id: input.sessionId },
    data: {
      status: input.status,
      score,
      grade,
      finishedAt: new Date(),
      lastActiveAt: new Date(),
      inFlightKey: null,
      inFlightUntil: null,
    },
  });

  if (!input.isTutorial) {
    const where = { playerId_caseId: { playerId: input.playerId, caseId: input.caseId } };
    const totalPlays = await tx.playSession.count({
      where: { playerId: input.playerId, caseId: input.caseId, status: { not: 'ACTIVE' } },
    });
    const existing = await tx.caseRecord.findUnique({ where });
    const solved = input.status === 'SOLVED';
    if (!existing) {
      await tx.caseRecord.create({
        data: {
          playerId: input.playerId,
          caseId: input.caseId,
          bestGrade: grade,
          bestScore: score,
          bestPlayNo: input.playNo,
          totalPlays,
          solved,
        },
      });
    } else {
      const better = isBetter(
        { grade, score },
        { grade: existing.bestGrade, score: existing.bestScore },
      );
      await tx.caseRecord.update({
        where,
        data: {
          totalPlays,
          solved: existing.solved || solved,
          ...(better ? { bestGrade: grade, bestScore: score, bestPlayNo: input.playNo } : {}),
        },
      });
    }
  }
  return { grade, score };
}
