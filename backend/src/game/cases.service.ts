import { Injectable } from '@nestjs/common';
import {
  genreSchema,
  type CaseDetail,
  type CaseSummary,
  type CreateSessionResponse,
} from '@mysterytalk/shared';
import { z } from 'zod';
import { AppException } from '../common/app-exception.js';
import type { Player } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadAsset, questionCap } from './case-data.js';

const genresSchema = z.array(genreSchema);

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 공개 사건 목록. 서버 전용 필드(사실·정답·힌트·해설)는 select 하지 않는다. */
  async list(player: Player): Promise<CaseSummary[]> {
    const cases = await this.prisma.mysteryCase.findMany({
      where: { isPublished: true },
      orderBy: [{ isTutorial: 'desc' }, { difficulty: 'asc' }, { caseNo: 'asc' }],
      select: {
        id: true,
        slug: true,
        isTutorial: true,
        caseNo: true,
        cover: true,
        currentVersion: true,
        title: true,
        summary: true,
        difficulty: true,
        rating: true,
        tags: true,
        genres: true,
        sessions: { where: { playerId: player.id, status: 'ACTIVE' }, select: { id: true } },
        records: {
          where: { playerId: player.id },
          select: { bestGrade: true, bestPlayNo: true, totalPlays: true, solved: true },
        },
      },
    });
    return cases.map((c) => ({
      slug: c.slug,
      isTutorial: c.isTutorial,
      caseNo: c.caseNo,
      coverVersion: c.cover ? c.currentVersion : null,
      title: c.title,
      summary: c.summary,
      difficulty: c.difficulty,
      rating: c.rating,
      tags: c.tags,
      genres: genresSchema.parse(c.genres),
      activeSessionId: c.sessions[0]?.id ?? null,
      record: c.records[0] ?? null,
    }));
  }

  async detail(slug: string): Promise<CaseDetail> {
    const c = await this.prisma.mysteryCase.findFirst({
      where: { slug, isPublished: true },
      select: {
        slug: true,
        isTutorial: true,
        caseNo: true,
        cover: true,
        currentVersion: true,
        title: true,
        summary: true,
        intro: true,
        elementCount: true,
        difficulty: true,
        baseQuestions: true,
        rating: true,
        tags: true,
        genres: true,
      },
    });
    if (!c) throw new AppException(404, 'NOT_FOUND');
    const { cover, currentVersion, ...rest } = c;
    return {
      ...rest,
      coverVersion: cover ? currentVersion : null,
      maxQuestions: questionCap(c.baseQuestions),
      genres: genresSchema.parse(c.genres),
    };
  }

  /** 카드 대표 그림(D98). 시작 전에 보여 주는 그림이라 세션 없이 공개 사건이면 내려준다 */
  async cover(slug: string): Promise<{ mime: string; bytes: Uint8Array }> {
    const c = await this.prisma.mysteryCase.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, cover: true, currentVersion: true },
    });
    if (!c?.cover) throw new AppException(404, 'NOT_FOUND');
    return loadAsset(this.prisma, c.id, c.currentVersion, c.cover);
  }

  /**
   * 새 플레이 세션을 시작한다. 사건당 진행 중 세션은 1개(PRD D54, DB 부분 고유 인덱스로 강제).
   * 회차는 그 플레이어의 해당 사건 세션 수 + 1(PRD D18).
   */
  async createSession(player: Player, slug: string): Promise<CreateSessionResponse> {
    const c = await this.prisma.mysteryCase.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, currentVersion: true },
    });
    if (!c) throw new AppException(404, 'NOT_FOUND');
    try {
      const session = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.playSession.count({
          where: { playerId: player.id, caseId: c.id },
        });
        return tx.playSession.create({
          data: {
            playerId: player.id,
            caseId: c.id,
            caseVersion: c.currentVersion,
            playNo: previous + 1,
          },
          select: { id: true },
        });
      });
      return { sessionId: session.id };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppException(409, 'ACTIVE_SESSION_EXISTS');
      }
      throw error;
    }
  }
}
