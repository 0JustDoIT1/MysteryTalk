import type { JudgeCallMeta } from '../judge/judge.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** AI 호출 기록(SPEC §10). 질문·답안 원문은 남기지 않는다. 비용은 단가표로 계산한 추정치(로컬 Ollama는 0원). */
export async function recordAiCalls(
  prisma: PrismaService,
  purpose: 'JUDGE' | 'GRADE',
  sessionId: string,
  calls: JudgeCallMeta[],
  costs: number[] = [],
): Promise<void> {
  if (!calls.length) return;
  await prisma.aiCall.createMany({
    data: calls.map((c, i) => ({
      purpose,
      sessionId,
      model: c.model,
      tokensIn: c.tokensIn,
      tokensOut: c.tokensOut,
      latencyMs: c.latencyMs,
      ok: c.ok,
      estCostKrw: costs[i] ?? 0,
    })),
  });
}
