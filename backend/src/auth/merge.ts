import type { Prisma } from '../generated/prisma/client.js';
import { recomputeRecords } from '../game/records.js';

type Tx = Prisma.TransactionClient;

/**
 * 게스트 기록을 로그인 계정으로 옮긴다(SPEC §3.2, PRD D31·D82). 한 트랜잭션 안에서 호출한다.
 * 1. 같은 사건의 진행 중 세션이 양쪽에 있으면 마지막 활동이 더 최근인 쪽만 남긴다(다른 쪽은 F 없이 삭제).
 * 2. 게스트의 나머지 세션(끝난 기록 포함)을 계정으로 옮긴다.
 * 3. 계정의 회차·사건별 기록을 플레이 시작 시각 순으로 다시 계산한다.
 * 4. 게스트는 이전 완료로 표시하고 토큰을 지워 다시 쓸 수 없게 한다.
 * 이미 이전된 게스트면 아무것도 하지 않는다(멱등).
 */
export async function mergeGuestInto(tx: Tx, guestId: string, userId: string): Promise<void> {
  if (guestId === userId) return;
  // 같은 게스트로 동시에 로그인해도 한 번만 이전되도록 게스트 행을 잠근다.
  await tx.$queryRaw`SELECT id FROM player WHERE id = ${guestId}::uuid FOR UPDATE`;
  const guest = await tx.player.findUnique({ where: { id: guestId } });
  if (!guest || guest.kind !== 'GUEST' || guest.mergedIntoId) return;

  const [guestActive, userActive] = await Promise.all([
    tx.playSession.findMany({
      where: { playerId: guestId, status: 'ACTIVE' },
      select: { id: true, caseId: true, lastActiveAt: true },
    }),
    tx.playSession.findMany({
      where: { playerId: userId, status: 'ACTIVE' },
      select: { id: true, caseId: true, lastActiveAt: true },
    }),
  ]);
  const drop: string[] = [];
  for (const g of guestActive) {
    const u = userActive.find((x) => x.caseId === g.caseId);
    if (!u) continue;
    drop.push(g.lastActiveAt > u.lastActiveAt ? u.id : g.id);
  }
  if (drop.length) await tx.playSession.deleteMany({ where: { id: { in: drop } } });

  await tx.playSession.updateMany({ where: { playerId: guestId }, data: { playerId: userId } });
  await tx.caseRecord.deleteMany({ where: { playerId: guestId } });
  await recomputeRecords(tx, userId);
  await tx.player.update({
    where: { id: guestId },
    data: { mergedIntoId: userId, guestTokenHash: null },
  });
}
