import { AppException } from '../common/app-exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * 세션 처리 중 선점(SPEC §6-8). 질문과 제출이 같은 선점을 쓰므로 한 세션에서 AI 호출은 한 번에 하나다.
 * 다른 요청이 처리 중이면 409 SESSION_BUSY. 만료된 선점은 새 요청이 가져갈 수 있다.
 */
export async function claimLease(
  prisma: PrismaService,
  sessionId: string,
  key: string,
  leaseMs: number,
): Promise<void> {
  const claimed = await prisma.playSession.updateMany({
    where: {
      id: sessionId,
      status: 'ACTIVE',
      OR: [{ inFlightKey: null }, { inFlightUntil: { lt: new Date() } }],
    },
    data: { inFlightKey: key, inFlightUntil: new Date(Date.now() + leaseMs) },
  });
  if (claimed.count === 0) throw new AppException(409, 'SESSION_BUSY');
}

/** 내 선점일 때만 해제한다(만료 후 다른 요청이 가져간 선점은 건드리지 않음). */
export async function releaseLease(
  prisma: PrismaService,
  sessionId: string,
  key: string,
): Promise<void> {
  await prisma.playSession.updateMany({
    where: { id: sessionId, inFlightKey: key },
    data: { inFlightKey: null, inFlightUntil: null },
  });
}

/**
 * 질문 판정의 최대 단계 수: 첫 판정 → 복합 질문 재판정(compound-guard) → 부정형 재확인(negation).
 * 단계마다 1회 재시도까지 하므로 최대 6회 호출된다.
 */
export const JUDGE_MAX_STAGES = 3;

/** 선점 시간 = AI 타임아웃 × 2(1회 재시도) × 단계 수 + 여유 15초. 채점은 1단계. */
export function leaseMsFor(llmTimeoutMs: number, stages = 1): number {
  return llmTimeoutMs * 2 * stages + 15_000;
}
