import type { JudgeCallMeta } from '../judge/judge.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** AI 호출 기록(SPEC §10). 질문·답안 원문은 남기지 않는다. 로컬 Ollama는 비용 0원, 단가표는 7단계에서 추가. */
export async function recordAiCalls(
  prisma: PrismaService,
  purpose: 'JUDGE' | 'GRADE',
  sessionId: string,
  calls: JudgeCallMeta[],
): Promise<void> {
  if (!calls.length) return;
  await prisma.aiCall.createMany({
    data: calls.map((c) => ({
      purpose,
      sessionId,
      model: c.model,
      tokensIn: c.tokensIn,
      tokensOut: c.tokensOut,
      latencyMs: c.latencyMs,
      ok: c.ok,
    })),
  });
}
