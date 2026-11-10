import { Injectable } from '@nestjs/common';
import type { QuestionLabel, QuestionLogItem, SessionState } from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { Player } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { questionCap } from './case-data.js';

const uuid = z.uuid();

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 플레이어 소유 세션만 돌려준다. 남의 세션이거나 형식이 틀린 id는 404(존재 여부 노출 방지, SPEC §5).
   */
  async loadOwned(player: Player, sessionId: string) {
    if (!uuid.safeParse(sessionId).success) throw new AppException(404, 'NOT_FOUND');
    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId, playerId: player.id },
      include: {
        case: {
          select: { id: true, slug: true, intro: true, baseQuestions: true, currentVersion: true },
        },
      },
    });
    if (!session) throw new AppException(404, 'NOT_FOUND');
    return session;
  }

  async state(player: Player, sessionId: string): Promise<SessionState> {
    const s = await this.loadOwned(player, sessionId);
    return {
      sessionId: s.id,
      caseSlug: s.case.slug,
      status: s.status,
      questionsUsed: s.questionsUsed,
      baseQuestions: s.case.baseQuestions,
      questionCap: questionCap(s.case.baseQuestions),
    };
  }

  /** 질문 기록(PRD D48). '다시 질문'은 순번(turnNo) 없이 포함된다. */
  async questions(
    player: Player,
    sessionId: string,
    label?: QuestionLabel,
  ): Promise<QuestionLogItem[]> {
    const s = await this.loadOwned(player, sessionId);
    const logs = await this.prisma.questionLog.findMany({
      where: { sessionId: s.id, ...(label ? { label } : {}) },
      orderBy: { createdAt: 'asc' },
      select: { turnNo: true, question: true, label: true, retryReason: true, createdAt: true },
    });
    return logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }));
  }
}
