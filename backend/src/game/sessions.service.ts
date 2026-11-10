import { Injectable } from '@nestjs/common';
import {
  MAX_SUBMISSIONS,
  type Ending,
  type HintState,
  type QuestionLabel,
  type QuestionLogItem,
  type SessionState,
} from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { Player } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadVersion, questionCap, type CaseVersionData } from './case-data.js';
import { finishSession } from './finish.js';
import { computeScore, hintUnlockAt } from './scoring.js';

const uuid = z.uuid();
const matchedSchema = z.array(z.object({ id: z.string(), agreement: z.string() }));

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
          select: {
            id: true,
            slug: true,
            title: true,
            isTutorial: true,
            intro: true,
            baseQuestions: true,
            currentVersion: true,
            explanation: true,
          },
        },
      },
    });
    if (!session) throw new AppException(404, 'NOT_FOUND');
    return session;
  }

  async state(player: Player, sessionId: string): Promise<SessionState> {
    const s = await this.loadOwned(player, sessionId);
    const data = await loadVersion(this.prisma, s.case.id, s.case.currentVersion);
    const viewed = await this.viewedHints(s.id);
    return {
      sessionId: s.id,
      caseSlug: s.case.slug,
      isTutorial: s.case.isTutorial,
      playNo: s.playNo,
      status: s.status,
      questionsUsed: s.questionsUsed,
      baseQuestions: s.case.baseQuestions,
      questionCap: questionCap(s.case.baseQuestions),
      wrongSubmissions: s.wrongSubmissions,
      submissionsLeft: MAX_SUBMISSIONS - s.wrongSubmissions,
      hints: this.hintStates(data, s.case.baseQuestions, s.questionsUsed, viewed),
      memo: s.memo,
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

  /**
   * 힌트 열람(SPEC §9.1, PRD D15). 해금된 힌트만, 순서대로만 열 수 있다.
   * 이미 연 힌트를 다시 요청하면 같은 내용을 돌려준다(PK로 이중 감점 없음 → 자연 멱등).
   */
  async viewHint(player: Player, sessionId: string, no: number): Promise<HintState> {
    const s = await this.loadOwned(player, sessionId);
    if (s.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
    const data = await loadVersion(this.prisma, s.case.id, s.case.currentVersion);
    const viewed = await this.viewedHints(s.id);
    const hints = this.hintStates(data, s.case.baseQuestions, s.questionsUsed, viewed);
    const target = hints.find((h) => h.no === no);
    if (!target) throw new AppException(404, 'NOT_FOUND');
    if (target.viewed) return target;
    const previousViewed = hints.filter((h) => h.no < no).every((h) => h.viewed);
    if (!target.unlocked || !previousViewed) throw new AppException(409, 'HINT_LOCKED');
    await this.prisma.hintView.createMany({
      data: [{ sessionId: s.id, hintNo: no }],
      skipDuplicates: true,
    });
    await this.prisma.playSession.update({
      where: { id: s.id },
      data: { lastActiveAt: new Date() },
    });
    return { ...target, viewed: true, text: data.hints.find((h) => h.no === no)?.text ?? null };
  }

  /** 메모 저장(PRD D62). AI에 전달하지 않는다. 같은 내용을 다시 보내도 결과가 같다(PUT). */
  async saveMemo(player: Player, sessionId: string, memo: string): Promise<{ memo: string }> {
    const s = await this.loadOwned(player, sessionId);
    await this.prisma.playSession.update({ where: { id: s.id }, data: { memo } });
    return { memo };
  }

  /**
   * 수사 포기(PRD D80) → F, 해설 공개. 이미 포기한 세션은 그대로 성공(멱등),
   * 다른 이유로 끝난 세션은 409. 처리 중인 질문·제출의 선점은 해제되고, 그 결과는 확정 단계에서 버려진다.
   */
  async abandon(player: Player, sessionId: string): Promise<{ status: 'ABANDONED' }> {
    const s = await this.loadOwned(player, sessionId);
    if (s.status === 'ABANDONED') return { status: 'ABANDONED' };
    if (s.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { status: string; questions_used: number; wrong_submissions: number }[]
      >`SELECT status, questions_used, wrong_submissions FROM play_session WHERE id = ${s.id}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new AppException(404, 'NOT_FOUND');
      if (row.status === 'ABANDONED') return;
      if (row.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
      await finishSession(tx, {
        sessionId: s.id,
        playerId: s.playerId,
        caseId: s.caseId,
        isTutorial: s.case.isTutorial,
        playNo: s.playNo,
        status: 'ABANDONED',
        baseQuestions: s.case.baseQuestions,
        questionsUsed: row.questions_used,
        wrongSubmissions: row.wrong_submissions,
      });
    });
    return { status: 'ABANDONED' };
  }

  /** 엔딩(PRD D19, D61): 종료된 세션에만 해설·점수 내역·요소별 충족을 공개한다. */
  async ending(player: Player, sessionId: string): Promise<Ending> {
    const s = await this.loadOwned(player, sessionId);
    if (s.status === 'ACTIVE' || !s.grade) throw new AppException(409, 'SESSION_NOT_FINISHED');
    const data = await loadVersion(this.prisma, s.case.id, s.caseVersion);
    const hintsViewed = await this.prisma.hintView.count({ where: { sessionId: s.id } });
    const last = await this.prisma.submission.findFirst({
      where: { sessionId: s.id },
      orderBy: { createdAt: 'desc' },
      select: { matched: true },
    });
    const matched = matchedSchema.safeParse(last?.matched ?? []);
    const matchedIds = new Set(
      (matched.success ? matched.data : []).filter((m) => m.agreement === 'MATCH').map((m) => m.id),
    );
    const { breakdown } = computeScore({
      baseQuestions: s.case.baseQuestions,
      questionsUsed: s.questionsUsed,
      hintsViewed,
      wrongSubmissions: s.wrongSubmissions,
    });
    return {
      caseSlug: s.case.slug,
      title: s.case.title,
      isTutorial: s.case.isTutorial,
      recorded: !s.case.isTutorial,
      playNo: s.playNo,
      status: s.status,
      grade: s.grade,
      score: s.score,
      breakdown,
      elements: data.elements.map((e) => ({
        id: e.id,
        description: e.description,
        required: e.required,
        matched: matchedIds.has(e.id),
      })),
      explanation: s.case.explanation,
    };
  }

  private async viewedHints(sessionId: string): Promise<Set<number>> {
    const rows = await this.prisma.hintView.findMany({
      where: { sessionId },
      select: { hintNo: true },
    });
    return new Set(rows.map((r) => r.hintNo));
  }

  private hintStates(
    data: CaseVersionData,
    baseQuestions: number,
    questionsUsed: number,
    viewed: Set<number>,
  ): HintState[] {
    const unlockAt = hintUnlockAt(baseQuestions);
    return [...data.hints]
      .sort((a, b) => a.no - b.no)
      .map((h) => ({
        no: h.no,
        unlockAt: unlockAt[h.no - 1]!,
        unlocked: questionsUsed >= unlockAt[h.no - 1]!,
        viewed: viewed.has(h.no),
        text: viewed.has(h.no) ? h.text : null,
      }));
  }
}
