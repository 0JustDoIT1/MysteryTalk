import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COUNTED_LABELS,
  askQuestionResponseSchema,
  type AskQuestionResponse,
} from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import type { Player } from '../generated/prisma/client.js';
import { duplicateKey, normalizeQuestion } from '../judge/normalize.js';
import { prefilterAbuse } from '../judge/prefilter.js';
import {
  JUDGE,
  PROMPT_VERSION,
  type Judge,
  type JudgeCallMeta,
  type JudgeResult,
} from '../judge/judge.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadFacts, questionCap } from './case-data.js';
import { SessionsService } from './sessions.service.js';

const uuid = z.uuid();

/**
 * 질문 판정 파이프라인(SPEC §6, PRD §5.2).
 * 핵심 보장: 같은 멱등성 키는 한 번만 처리, 판정 실패는 미차감, AI 호출은 트랜잭션 밖,
 * 늦게 도착한 결과가 다른 요청의 선점을 덮어쓰지 않음(이중 차감 방지).
 */
@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
    @Inject(JUDGE) private readonly judge: Judge,
  ) {}

  async ask(
    player: Player,
    sessionId: string,
    idempotencyKey: string | undefined,
    rawQuestion: string,
  ): Promise<AskQuestionResponse> {
    // 1. 소유·상태
    const session = await this.sessions.loadOwned(player, sessionId);
    if (!idempotencyKey) throw new AppException(400, 'IDEMPOTENCY_KEY_REQUIRED');
    if (!uuid.safeParse(idempotencyKey).success) throw new AppException(422, 'INVALID_INPUT');

    // 3. 입력 정규화·길이(2~100자)
    const question = normalizeQuestion(rawQuestion);
    if (question === null) throw new AppException(422, 'INVALID_INPUT');

    // 2. 멱등성: 같은 키로 이미 처리된 요청이면 저장된 응답, 문장이 다르면 422
    const previous = await this.prisma.questionLog.findUnique({
      where: { sessionId_idempotencyKey: { sessionId: session.id, idempotencyKey } },
      select: { question: true, response: true },
    });
    if (previous) {
      if (previous.question !== question) throw new AppException(422, 'IDEMPOTENCY_MISMATCH');
      return askQuestionResponseSchema.parse(previous.response);
    }

    if (session.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
    const base = session.case.baseQuestions;
    const cap = questionCap(base);
    const normalized = duplicateKey(question);

    // 4. 같은 문장 재질문: 이전 판정 재표시, 미차감, AI 호출 없음(D5)
    const same = await this.prisma.questionLog.findFirst({
      where: { sessionId: session.id, normalized },
      orderBy: { createdAt: 'asc' },
      select: { label: true, retryReason: true, turnNo: true },
    });
    if (same) {
      return {
        label: same.label,
        retryReason: same.retryReason,
        duplicate: true,
        counted: false,
        turnNo: same.turnNo,
        questionsUsed: session.questionsUsed,
        baseQuestions: base,
        questionCap: cap,
      };
    }

    // 5. 서버 상한 3B(D49). 6. 일일·월 한도는 7단계에서 이 위치에 추가한다(SPEC §10).
    if (session.questionsUsed >= cap) throw new AppException(409, 'QUESTION_CAP_REACHED');

    // 8. 처리 중 선점(원자적). 다른 요청이 처리 중이면 409.
    const leaseMs = this.config.get('LLM_TIMEOUT_MS', { infer: true }) * 2 + 15_000;
    const claimed = await this.prisma.playSession.updateMany({
      where: {
        id: session.id,
        status: 'ACTIVE',
        OR: [{ inFlightKey: null }, { inFlightUntil: { lt: new Date() } }],
      },
      data: { inFlightKey: idempotencyKey, inFlightUntil: new Date(Date.now() + leaseMs) },
    });
    if (claimed.count === 0) throw new AppException(409, 'SESSION_BUSY');

    // 7. 사전 필터(욕설·조작 지시) → AI 없이 '다시 질문'. 9. 아니면 AI 판정(트랜잭션 밖)
    // 사건 내용이 수정됐으면 진행 중 세션에도 최신 버전을 적용하고, 판정 당시 버전을 기록한다(D59).
    const caseVersion = session.case.currentVersion;
    let result: JudgeResult;
    let model: string | null = null;
    if (prefilterAbuse(question)) {
      result = { label: 'RETRY', retryReason: 'ABUSE', factIds: [] };
    } else {
      const facts = await loadFacts(this.prisma, session.case.id, caseVersion);
      const outcome = await this.judge.judge({ intro: session.case.intro, facts, question });
      await this.recordCalls(session.id, outcome.calls);
      if (!outcome.ok) {
        // 10. 실패: 선점 해제, 미차감, 기록 없음 → 같은 키로 재시도 가능(D6)
        this.logger.warn(`judge failed (${outcome.reason}) session=${session.id}`);
        await this.release(session.id, idempotencyKey);
        throw new AppException(503, 'AI_UNAVAILABLE');
      }
      result = outcome.result;
      model = this.judge.model;
    }

    // 11. 확정(짧은 트랜잭션): 선점 소유 재확인 → 차감·순번 → 기록 → 선점 해제
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ questions_used: number; in_flight_key: string | null }[]>`
        SELECT questions_used, in_flight_key FROM play_session WHERE id = ${session.id}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row || row.in_flight_key !== idempotencyKey) {
        // 선점이 만료돼 다른 요청이 가져갔다면 이 결과는 버린다(이중 차감 방지).
        throw new AppException(409, 'SESSION_BUSY');
      }
      const counted = COUNTED_LABELS.includes(result.label);
      const used = row.questions_used + (counted ? 1 : 0);
      const response: AskQuestionResponse = {
        label: result.label,
        retryReason: result.retryReason,
        duplicate: false,
        counted,
        turnNo: counted ? used : null,
        questionsUsed: used,
        baseQuestions: base,
        questionCap: cap,
      };
      await tx.playSession.update({
        where: { id: session.id },
        data: {
          questionsUsed: used,
          caseVersion,
          inFlightKey: null,
          inFlightUntil: null,
          lastActiveAt: new Date(),
        },
      });
      await tx.questionLog.create({
        data: {
          sessionId: session.id,
          idempotencyKey,
          question,
          normalized,
          label: result.label,
          retryReason: result.retryReason,
          factIds: result.factIds,
          counted,
          turnNo: response.turnNo,
          caseVersion,
          model,
          promptVersion: model ? PROMPT_VERSION : null,
          response,
        },
      });
      return response;
    });
  }

  private async release(sessionId: string, key: string): Promise<void> {
    await this.prisma.playSession.updateMany({
      where: { id: sessionId, inFlightKey: key },
      data: { inFlightKey: null, inFlightUntil: null },
    });
  }

  /** AI 호출 기록(SPEC §10). 로컬 Ollama는 비용 0원. 단가표는 7단계에서 추가. */
  private async recordCalls(sessionId: string, calls: JudgeCallMeta[]): Promise<void> {
    if (!calls.length) return;
    await this.prisma.aiCall.createMany({
      data: calls.map((c) => ({
        purpose: 'JUDGE' as const,
        sessionId,
        model: c.model,
        tokensIn: c.tokensIn,
        tokensOut: c.tokensOut,
        latencyMs: c.latencyMs,
        ok: c.ok,
      })),
    });
  }
}
