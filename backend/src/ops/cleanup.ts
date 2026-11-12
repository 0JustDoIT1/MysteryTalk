import type { PrismaClient } from '../generated/prisma/client.js';
import { dayKey } from './keys.js';

/** 게스트 기록 보관 기간: 마지막 활동 후 30일(PRD D32) */
export const GUEST_RETENTION_DAYS = 30;
/** 일일 사용량(IP 해시 포함) 보관 기간. 한도 계산에는 오늘 것만 쓰므로 길게 둘 이유가 없다. */
export const USAGE_RETENTION_DAYS = 30;

export type CleanupResult = {
  guests: number;
  mergedGuests: number;
  expiredSessions: number;
  usageRows: number;
};

/**
 * 운영 정리(SPEC §3.3): 하루 한 번 외부 예약 실행으로 돌린다(`npm run cleanup:guests -w backend`).
 * - 마지막 활동 후 30일 지난 게스트와 그 기록(질문 원문·메모 포함, 연쇄 삭제)
 * - 계정으로 이전이 끝난 게스트(기록은 이미 계정으로 옮겨져 비어 있음)
 * - 만료된 로그인 세션, 보관 기간이 지난 일일 사용량
 * dryRun 이면 지울 개수만 센다. 로그인 사용자의 기록은 건드리지 않는다(탈퇴 절차는 [미정]).
 */
export async function cleanup(
  prisma: PrismaClient,
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<CleanupResult> {
  const now = options.now ?? new Date();
  const guestCutoff = new Date(now.getTime() - GUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const usageCutoff = new Date(
    dayKey(new Date(now.getTime() - USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000)),
  );

  const staleGuests = {
    kind: 'GUEST' as const,
    mergedIntoId: null,
    lastActiveAt: { lt: guestCutoff },
  };
  const mergedGuests = { kind: 'GUEST' as const, mergedIntoId: { not: null } };
  const expired = { expiresAt: { lt: now } };
  const oldUsage = { day: { lt: usageCutoff } };

  if (options.dryRun) {
    const [guests, merged, sessions, usage] = await Promise.all([
      prisma.player.count({ where: staleGuests }),
      prisma.player.count({ where: mergedGuests }),
      prisma.authSession.count({ where: expired }),
      prisma.usageDaily.count({ where: oldUsage }),
    ]);
    return { guests, mergedGuests: merged, expiredSessions: sessions, usageRows: usage };
  }

  const guests = await prisma.player.deleteMany({ where: staleGuests });
  const merged = await prisma.player.deleteMany({ where: mergedGuests });
  const sessions = await prisma.authSession.deleteMany({ where: expired });
  const usage = await prisma.usageDaily.deleteMany({ where: oldUsage });
  return {
    guests: guests.count,
    mergedGuests: merged.count,
    expiredSessions: sessions.count,
    usageRows: usage.count,
  };
}
