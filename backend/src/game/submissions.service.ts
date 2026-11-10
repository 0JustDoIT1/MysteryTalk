import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAX_DETAIL_REQUESTS,
  MAX_SUBMISSIONS,
  submitAnswerResponseSchema,
  type SubmitAnswerResponse,
} from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import type { Player } from '../generated/prisma/client.js';
import { decide, failedStatus } from '../grade/decide.js';
import { GRADER, GRADE_PROMPT_VERSION, type Grader } from '../grade/grader.types.js';
import { normalizeAnswer } from '../judge/normalize.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recordAiCalls } from './ai-calls.js';
import { loadVersion } from './case-data.js';
import { finishSession } from './finish.js';
import { claimLease, leaseMsFor, releaseLease } from './session-lease.js';
import { SessionsService } from './sessions.service.js';

const uuid = z.uuid();

/**
 * 정답 채점 파이프라인(SPEC §7, PRD §8).
 * 키워드 + AI 하이브리드(D20): 요소마다 둘이 일치하면 확정, 엇갈리면 미확정.
 * 질문과 같은 선점·멱등성 규칙을 쓰고, AI 실패는 제출 기회·감점을 차감하지 않는다(D73).
 */
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
    @Inject(GRADER) private readonly grader: Grader,
  ) {}

  async submit(
    player: Player,
    sessionId: string,
    idempotencyKey: string | undefined,
    rawAnswer: string,
  ): Promise<SubmitAnswerResponse> {
    // 1. 소유·멱등성·입력(10~300자)
    const session = await this.sessions.loadOwned(player, sessionId);
    if (!idempotencyKey) throw new AppException(400, 'IDEMPOTENCY_KEY_REQUIRED');
    if (!uuid.safeParse(idempotencyKey).success) throw new AppException(422, 'INVALID_INPUT');
    const answer = normalizeAnswer(rawAnswer);
    if (answer === null) throw new AppException(422, 'INVALID_INPUT');

    const previous = await this.prisma.submission.findUnique({
      where: { sessionId_idempotencyKey: { sessionId: session.id, idempotencyKey } },
      select: { answer: true, response: true },
    });
    if (previous) {
      if (previous.answer !== answer) throw new AppException(422, 'IDEMPOTENCY_MISMATCH');
      return submitAnswerResponseSchema.parse(previous.response);
    }
    if (session.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
    // 2. 월 예산·예비 예산은 7단계에서 이 위치에 추가한다. 일일 질문 한도는 제출에 적용하지 않는다(D83).

    // 3. 선점 → AI 요소별 판정(트랜잭션 밖)
    await claimLease(
      this.prisma,
      session.id,
      idempotencyKey,
      leaseMsFor(this.config.get('LLM_TIMEOUT_MS', { infer: true })),
    );
    const caseVersion = session.case.currentVersion;
    const data = await loadVersion(this.prisma, session.case.id, caseVersion);
    // 재작성 요청을 다 썼으면 마지막 판정: AI는 MATCH/NO_MATCH만 고른다(D23).
    // 선점을 잡은 뒤에 다시 읽는다(선점 중에는 다른 제출이 이 값을 바꾸지 못한다).
    const { detailRequestsUsed } = await this.prisma.playSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { detailRequestsUsed: true },
    });
    const final = detailRequestsUsed >= MAX_DETAIL_REQUESTS;
    const outcome = await this.grader.grade({
      intro: session.case.intro,
      facts: data.facts,
      elements: data.elements.map((e) => ({
        id: e.id,
        description: e.description,
        keywordGroups: e.keywordGroups,
      })),
      answer,
      final,
    });
    await recordAiCalls(this.prisma, 'GRADE', session.id, outcome.calls);
    if (!outcome.ok) {
      // 7. 실패: 미차감·기록 없음 → 같은 키로 재시도(D73)
      this.logger.warn(`grade failed (${outcome.reason}) session=${session.id}`);
      await releaseLease(this.prisma, session.id, idempotencyKey);
      throw new AppException(503, 'AI_UNAVAILABLE');
    }

    // 4~8. 확정(짧은 트랜잭션): 선점 재확인 → 합의·결과 결정 → 기록 → 필요하면 종료
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          status: string;
          in_flight_key: string | null;
          questions_used: number;
          wrong_submissions: number;
          detail_requests_used: number;
        }[]
      >`SELECT status, in_flight_key, questions_used, wrong_submissions, detail_requests_used
        FROM play_session WHERE id = ${session.id}::uuid FOR UPDATE`;
      const row = rows[0];
      if (row && row.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
      if (!row || row.in_flight_key !== idempotencyKey) {
        throw new AppException(409, 'SESSION_BUSY');
      }

      // 마지막 판정이면 키워드와 엇갈린 요소도 AI 판정으로 확정한다(D23).
      const decision = decide(data.elements, answer, outcome.verdicts, final);
      let wrong = row.wrong_submissions;
      let details = row.detail_requests_used;
      let status: SubmitAnswerResponse['status'] = 'ACTIVE';
      if (decision.result === 'WRONG') wrong += 1;
      if (decision.result === 'NEEDS_DETAIL') details += 1;

      await tx.playSession.update({
        where: { id: session.id },
        data: {
          wrongSubmissions: wrong,
          detailRequestsUsed: details,
          caseVersion,
          inFlightKey: null,
          inFlightUntil: null,
          lastActiveAt: new Date(),
        },
      });

      const finishWith =
        decision.result === 'SOLVED'
          ? 'SOLVED'
          : decision.result === 'WRONG' && wrong >= MAX_SUBMISSIONS
            ? failedStatus(decision.matchedCount, decision.totalCount)
            : null;
      if (finishWith) {
        // 해결 시 점수의 오답 감점은 '해결 전 오답'만 센다(SPEC §8).
        await finishSession(tx, {
          sessionId: session.id,
          playerId: session.playerId,
          caseId: session.caseId,
          isTutorial: session.case.isTutorial,
          playNo: session.playNo,
          status: finishWith,
          baseQuestions: session.case.baseQuestions,
          questionsUsed: row.questions_used,
          wrongSubmissions: wrong,
        });
        status = finishWith;
      }

      const isWrong = decision.result === 'WRONG';
      const response: SubmitAnswerResponse = {
        result: decision.result,
        detailReason:
          decision.result === 'NEEDS_DETAIL'
            ? outcome.form === 'STATEMENT'
              ? 'DETAIL'
              : 'FORM'
            : null,
        // 개수는 오답일 때만(재작성 요청과 함께는 표시하지 않음, D21)
        matchedCount: isWrong ? decision.matchedCount : null,
        totalCount: isWrong ? decision.totalCount : null,
        submissionsLeft: MAX_SUBMISSIONS - wrong,
        status,
      };
      await tx.submission.create({
        data: {
          sessionId: session.id,
          idempotencyKey,
          answer,
          result: decision.result,
          matched: decision.elements,
          matchedCount: decision.matchedCount,
          totalCount: decision.totalCount,
          caseVersion,
          model: this.grader.model,
          promptVersion: GRADE_PROMPT_VERSION,
          response,
        },
      });
      return response;
    });
  }
}
