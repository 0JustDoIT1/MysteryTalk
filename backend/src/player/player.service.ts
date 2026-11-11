import { Injectable } from '@nestjs/common';
import {
  DEFAULT_DETECTIVE_NAME,
  DETECTIVE_NAME_MAX,
  DETECTIVE_NAME_MIN,
  type MeResponse,
} from '@mysterytalk/shared';
import type { Player } from '../generated/prisma/client.js';
import { AppException } from '../common/app-exception.js';
import { containsProfanity } from '../judge/prefilter.js';
import { normalizeText } from '../judge/normalize.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GUEST_TTL_MS, generateGuestToken, hashGuestToken } from './guest-token.js';

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 게스트 쿠키 토큰으로 플레이어를 찾는다.
   * 없거나, 다른 계정으로 이전됐거나, 30일 넘게 활동이 없으면 null(새 게스트를 발급해야 함).
   * 찾으면 마지막 활동 시각을 갱신한다.
   */
  async findGuest(token: string, now: Date = new Date()): Promise<Player | null> {
    const player = await this.prisma.player.findUnique({
      where: { guestTokenHash: hashGuestToken(token) },
    });
    if (!player || player.kind !== 'GUEST' || player.mergedIntoId) return null;
    if (now.getTime() - player.lastActiveAt.getTime() > GUEST_TTL_MS) return null;
    return this.prisma.player.update({
      where: { id: player.id },
      data: { lastActiveAt: now },
    });
  }

  /** 새 게스트 플레이어를 만들고 쿠키에 넣을 토큰 원문을 돌려준다. */
  async createGuest(): Promise<{ player: Player; token: string }> {
    const token = generateGuestToken();
    const player = await this.prisma.player.create({
      data: {
        kind: 'GUEST',
        guestTokenHash: hashGuestToken(token),
        detectiveName: DEFAULT_DETECTIVE_NAME,
      },
    });
    return { player, token };
  }

  /**
   * 탐정 이름 변경(PRD D40): 정규화 후 1~12자, 욕설 금지. 화면 고정 문구에만 쓰고 AI에는 전달하지 않는다.
   */
  async rename(player: Player, raw: string): Promise<Player> {
    const name = normalizeText(raw, DETECTIVE_NAME_MIN, DETECTIVE_NAME_MAX);
    if (name === null || containsProfanity(name)) throw new AppException(422, 'NAME_NOT_ALLOWED');
    return this.prisma.player.update({ where: { id: player.id }, data: { detectiveName: name } });
  }

  toMe(player: Player): Omit<MeResponse, 'loginAvailable'> {
    return {
      kind: player.kind,
      detectiveName: player.detectiveName,
      ageConfirmed: player.ageConfirmedAt !== null,
    };
  }
}
