import { answerElementSchema, factSchema, hintSchema, type Fact } from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const versionSchema = z.object({
  facts: z.array(factSchema),
  elements: z.array(answerElementSchema),
  hints: z.array(hintSchema),
});
export type CaseVersionData = z.infer<typeof versionSchema>;

/** 사건 버전의 비공개 데이터(사실·정답 요소·힌트)를 읽는다. DB 값도 다시 검증한다(신뢰하지 않음). */
export async function loadVersion(
  prisma: Pick<PrismaService, 'caseVersion'>,
  caseId: string,
  version: number,
): Promise<CaseVersionData> {
  const row = await prisma.caseVersion.findUnique({
    where: { caseId_version: { caseId, version } },
    select: { facts: true, elements: true, hints: true },
  });
  const parsed = versionSchema.safeParse(row);
  if (!parsed.success) throw new AppException(500, 'INTERNAL_ERROR');
  return parsed.data;
}

/** 세션이 판정에 쓸 사건 버전의 사실 목록 */
export async function loadFacts(
  prisma: Pick<PrismaService, 'caseVersion'>,
  caseId: string,
  version: number,
): Promise<Fact[]> {
  return (await loadVersion(prisma, caseId, version)).facts;
}

/** 서버 질문 상한 = 기준 질문 수 B의 3배(PRD D49) */
export function questionCap(baseQuestions: number): number {
  return baseQuestions * 3;
}
