import { factSchema, type Fact } from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const factsSchema = z.array(factSchema);

/** 세션이 판정에 쓸 사건 버전의 사실 목록을 읽는다. DB 값도 다시 검증한다(신뢰하지 않음). */
export async function loadFacts(
  prisma: PrismaService,
  caseId: string,
  version: number,
): Promise<Fact[]> {
  const row = await prisma.caseVersion.findUnique({
    where: { caseId_version: { caseId, version } },
    select: { facts: true },
  });
  const parsed = factsSchema.safeParse(row?.facts);
  if (!parsed.success) throw new AppException(500, 'INTERNAL_ERROR');
  return parsed.data;
}

/** 서버 질문 상한 = 기준 질문 수 B의 3배(PRD D49) */
export function questionCap(baseQuestions: number): number {
  return baseQuestions * 3;
}
