import type { ExploreContent } from '@mysterytalk/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { keywordMatch } from '../grade/decide.js';

type Tx = Prisma.TransactionClient;
type Unlocker =
  | { kind: 'CLUE'; clue: string }
  | { kind: 'FACT'; factIds: string[]; question: string }
  | { kind: 'HINT'; no: number };

/**
 * 구역(맵) 해금(SPEC §9.2, PRD D26·D74). 조건에 맞는 맵을 세션에 기록하고 새로 열린 맵 이름을 돌려준다.
 * - CLUE: 그 단서를 얻으면
 * - FACT: '예' 판정의 근거 사실에 포함되고 질문이 키워드 그룹을 통과하면(호출하는 쪽이 '예'만 넘긴다)
 * - HINT: 사실 해금 맵에 연결된 힌트를 열면
 * 같은 맵을 두 번 기록하지 않는다(PK + skipDuplicates).
 */
export async function unlockZones(
  tx: Tx,
  sessionId: string,
  explore: ExploreContent | null,
  by: Unlocker,
): Promise<string[]> {
  if (!explore) return [];
  const targets = explore.maps.filter((m) => {
    const u = m.unlock;
    if (by.kind === 'CLUE') return u.type === 'CLUE' && u.clue === by.clue;
    if (u.type !== 'FACT') return false;
    if (by.kind === 'HINT') return u.hint === by.no;
    return by.factIds.includes(u.fact) && keywordMatch(by.question, u.keywords);
  });
  if (!targets.length) return [];
  const already = new Set(
    (
      await tx.sessionZone.findMany({
        where: { sessionId, mapKey: { in: targets.map((m) => m.key) } },
        select: { mapKey: true },
      })
    ).map((z) => z.mapKey),
  );
  const fresh = targets.filter((m) => !already.has(m.key));
  if (!fresh.length) return [];
  await tx.sessionZone.createMany({
    data: fresh.map((m) => ({ sessionId, mapKey: m.key, unlockedBy: by.kind })),
    skipDuplicates: true,
  });
  return fresh.map((m) => m.name);
}

/** 열린 맵 key: 처음부터 열린 맵 + 세션에 기록된 맵 */
export function openMapKeys(explore: ExploreContent, recorded: string[]): Set<string> {
  return new Set([
    ...explore.maps.filter((m) => m.unlock.type === 'OPEN').map((m) => m.key),
    ...recorded,
  ]);
}
