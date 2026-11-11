import type { Prisma } from '../generated/prisma/client.js';
import { isBetter } from './scoring.js';

type Tx = Prisma.TransactionClient;

/**
 * 플레이어의 사건별 회차와 개인 기록을 세션 기록에서 다시 계산한다(SPEC §3.2, PRD D18·D82).
 * - 회차: 사건마다 플레이 시작 시각 순으로 1, 2, 3…
 * - 기록: 끝난 세션 중 최고 등급(같으면 높은 점수, 그것도 같으면 먼저 달성한 회차), 총 플레이 수, 해결 여부
 * 튜토리얼은 기록하지 않는다(D24).
 */
export async function recomputeRecords(tx: Tx, playerId: string): Promise<void> {
  const sessions = await tx.playSession.findMany({
    where: { playerId },
    orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      caseId: true,
      playNo: true,
      status: true,
      grade: true,
      score: true,
      case: { select: { isTutorial: true } },
    },
  });
  const byCase = new Map<string, typeof sessions>();
  for (const s of sessions) byCase.set(s.caseId, [...(byCase.get(s.caseId) ?? []), s]);

  await tx.caseRecord.deleteMany({ where: { playerId } });
  for (const [caseId, list] of byCase) {
    for (const [i, s] of list.entries()) {
      if (s.playNo !== i + 1) {
        await tx.playSession.update({ where: { id: s.id }, data: { playNo: i + 1 } });
      }
    }
    if (list[0]!.case.isTutorial) continue;
    const finished = list
      .map((s, i) => ({ ...s, playNo: i + 1 }))
      .filter((s) => s.status !== 'ACTIVE' && s.grade);
    if (!finished.length) continue;
    let best = finished[0]!;
    for (const s of finished.slice(1)) {
      if (
        isBetter({ grade: s.grade!, score: s.score }, { grade: best.grade!, score: best.score })
      ) {
        best = s;
      }
    }
    await tx.caseRecord.create({
      data: {
        playerId,
        caseId,
        bestGrade: best.grade!,
        bestScore: best.score,
        bestPlayNo: best.playNo,
        totalPlays: finished.length,
        solved: finished.some((s) => s.status === 'SOLVED'),
      },
    });
  }
}
