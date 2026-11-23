import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import type { Player } from '../generated/prisma/client.js';
import type { JudgeCallMeta } from '../judge/judge.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dayKey, ipHash, monthKey } from './keys.js';
import { estimateCostKrw } from './pricing.js';

type Subject = { subjectType: 'IP' | 'PLAYER'; subjectHash: string };

/** 일일 한도에서 잡은 질문 자리 1개 */
export type QuestionReservation = {
  where: Subject & { day: Date };
  column: 'questions' | 'tutorialQuestions';
};

/**
 * 비용·악용 방지(SPEC §10, PRD D44·D46·D58·D72·D83).
 * - 일일 질문 한도: 게스트는 IP, 로그인은 계정 단위. 튜토리얼은 따로 센다. AI에 보낸 질문만 센다.
 * - 월 AI 예산: 질문은 (한도 − 예비)까지, 정답 채점은 한도까지(예비 예산으로 제출은 계속 가능).
 * 어느 쪽이든 막히는 것은 새 질문뿐이고 정답 제출은 막지 않는다(일일 한도는 제출에 적용하지 않음).
 */
@Injectable()
export class LimitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private subject(player: Player, ip: string, now: Date): Subject {
    if (player.kind === 'USER') return { subjectType: 'PLAYER', subjectHash: player.id };
    const secret = this.config.get('IP_HASH_SECRET', { infer: true });
    return { subjectType: 'IP', subjectHash: ipHash(ip || 'unknown', secret, dayKey(now)) };
  }

  /**
   * 질문을 AI에 보내기 전에 일일 한도 자리를 원자적으로 하나 잡는다. 막히면 429.
   * '확인 후 나중에 증가'는 동시 요청이 모두 통과했다(코드 검수 2026-11-23) → 조건부 증가로 한 번에 처리한다.
   * 잡은 자리는 판정이 실패하거나 결과가 버려지면 releaseQuestion으로 돌려준다.
   * 반환값은 releaseQuestion에 넘길 표식(같은 날짜·대상에서 되돌리기 위해).
   */
  async reserveQuestion(
    player: Player,
    ip: string,
    tutorial: boolean,
    now = new Date(),
  ): Promise<QuestionReservation> {
    // 월 예산은 호출 비용이 끝나야 알 수 있어 미리 잡지 않는다. 동시에 처리 중인 질문만큼 넘을 수 있다.
    if (!(await this.withinBudget('JUDGE', now))) {
      throw new AppException(429, 'MONTHLY_BUDGET_REACHED');
    }
    const subject = this.subject(player, ip, now);
    const day = new Date(dayKey(now));
    const limit = tutorial
      ? this.config.get('DAILY_LIMIT_TUTORIAL', { infer: true })
      : player.kind === 'USER'
        ? this.config.get('DAILY_LIMIT_USER', { infer: true })
        : this.config.get('DAILY_LIMIT_GUEST', { infer: true });
    const column = tutorial ? 'tutorialQuestions' : 'questions';
    const where = { day, ...subject };
    // 행이 없으면 0으로 만든다. Prisma upsert는 동시 생성 때 고유 키 충돌(P2002)이 나서
    // PostgreSQL의 ON CONFLICT DO NOTHING을 쓴다.
    await this.prisma.$executeRaw`
      INSERT INTO usage_daily (day, subject_type, subject_hash)
      VALUES (${day}::date, ${subject.subjectType}::"UsageSubject", ${subject.subjectHash})
      ON CONFLICT DO NOTHING`;
    const claimed = await this.prisma.usageDaily.updateMany({
      where: limit > 0 ? { ...where, [column]: { lt: limit } } : where,
      data: { [column]: { increment: 1 } },
    });
    if (claimed.count === 0) throw new AppException(429, 'DAILY_LIMIT_REACHED');
    return { where, column };
  }

  /** reserveQuestion으로 잡은 자리를 돌려준다(판정 실패·결과 폐기·예외). */
  async releaseQuestion(r: QuestionReservation): Promise<void> {
    await this.prisma.usageDaily.updateMany({
      where: { ...r.where, [r.column]: { gt: 0 } },
      data: { [r.column]: { decrement: 1 } },
    });
  }

  /** 정답 채점 전 확인: 예비 예산까지 쓸 수 있다(D72). */
  async assertCanGrade(now = new Date()): Promise<void> {
    if (!(await this.withinBudget('GRADE', now))) {
      throw new AppException(429, 'MONTHLY_BUDGET_REACHED');
    }
  }

  /** AI 호출 비용을 이번 달 예산에 더한다. 반환값은 호출별 추정 비용(ai_call 기록용). */
  async spend(
    purpose: 'JUDGE' | 'GRADE',
    calls: JudgeCallMeta[],
    now = new Date(),
  ): Promise<number[]> {
    const costs = calls.map((c) => estimateCostKrw(c.model, c.tokensIn, c.tokensOut));
    const total = costs.reduce((a, b) => a + b, 0);
    if (total > 0) {
      await this.ensureMonth(now);
      await this.prisma.budgetMonth.update({
        where: { month: monthKey(now) },
        data:
          purpose === 'JUDGE'
            ? { spentJudgeKrw: { increment: total } }
            : { spentGradeKrw: { increment: total } },
      });
    }
    return costs;
  }

  private async withinBudget(purpose: 'JUDGE' | 'GRADE', now: Date): Promise<boolean> {
    const limit = this.config.get('MONTHLY_AI_BUDGET_KRW', { infer: true });
    if (limit <= 0) return true;
    const month = await this.ensureMonth(now);
    const spent = Number(month.spentJudgeKrw) + Number(month.spentGradeKrw);
    const cap = purpose === 'JUDGE' ? month.limitKrw - month.reserveKrw : month.limitKrw;
    return spent < cap;
  }

  /** 이번 달 예산 행. 설정이 바뀌면 한도·예비를 현재 설정으로 맞춘다. */
  private ensureMonth(now: Date) {
    const limitKrw = this.config.get('MONTHLY_AI_BUDGET_KRW', { infer: true });
    const reserveKrw = Math.round(
      limitKrw * this.config.get('BUDGET_RESERVE_RATIO', { infer: true }),
    );
    return this.prisma.budgetMonth.upsert({
      where: { month: monthKey(now) },
      create: { month: monthKey(now), limitKrw, reserveKrw },
      update: { limitKrw, reserveKrw },
    });
  }
}
