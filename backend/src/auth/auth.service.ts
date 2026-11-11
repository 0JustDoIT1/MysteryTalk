import { Injectable } from '@nestjs/common';
import { DEFAULT_DETECTIVE_NAME } from '@mysterytalk/shared';
import type { Player } from '../generated/prisma/client.js';
import { generateGuestToken, hashGuestToken } from '../player/guest-token.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SESSION_TTL_MS } from './auth-cookies.js';
import { mergeGuestInto } from './merge.js';

/** 연장 쓰기를 줄이려고 마지막 사용 후 1시간이 지났을 때만 만료를 늘린다. */
const SLIDE_AFTER_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 로그인 완료: 사용자(sub)를 찾거나 만들고, 지금 브라우저의 게스트 기록을 옮긴 뒤 세션 토큰을 발급한다.
   * 토큰 원문은 쿠키에만 두고 DB에는 해시만 저장한다.
   */
  async login(sub: string, guest: Player | null): Promise<{ user: Player; token: string }> {
    const token = generateGuestToken();
    const user = await this.prisma.$transaction(async (tx) => {
      const user =
        (await tx.player.findUnique({ where: { googleSub: sub } })) ??
        (await tx.player.create({
          data: { kind: 'USER', googleSub: sub, detectiveName: DEFAULT_DETECTIVE_NAME },
        }));
      if (guest) await mergeGuestInto(tx, guest.id, user.id);
      await tx.authSession.create({
        data: {
          playerId: user.id,
          tokenHash: hashGuestToken(token),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });
      return tx.player.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    });
    return { user, token };
  }

  /** 유효한 세션의 사용자. 만료됐거나 없으면 null. 쓰면 만료를 연장한다. */
  async findSessionUser(token: string, now: Date = new Date()): Promise<Player | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashGuestToken(token) },
      include: { player: true },
    });
    if (!session || session.expiresAt <= now || session.player.kind !== 'USER') return null;
    if (now.getTime() - session.lastUsedAt.getTime() > SLIDE_AFTER_MS) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
      });
      await this.prisma.player.update({
        where: { id: session.playerId },
        data: { lastActiveAt: now },
      });
    }
    return session.player;
  }

  async logout(token: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { tokenHash: hashGuestToken(token) } });
  }

  /** 로그인 사용자의 18세 확인 기록(PRD D33). 이미 있으면 처음 시각을 유지한다. */
  async confirmAge(user: Player, confirmedAt: Date): Promise<void> {
    if (user.ageConfirmedAt) return;
    await this.prisma.player.update({
      where: { id: user.id },
      data: { ageConfirmedAt: confirmedAt },
    });
  }
}
