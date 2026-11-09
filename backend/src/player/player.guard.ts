import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import type { Player } from '../generated/prisma/client.js';
import { readGuestToken, writeGuestCookie } from './guest-token.js';
import { PlayerService } from './player.service.js';

export type RequestWithPlayer = Request & { player: Player };

/**
 * 요청의 플레이어를 확정한다(SPEC §3.1).
 * - 유효한 게스트 쿠키가 있으면 그 플레이어(쿠키 만료 연장)
 * - 없거나 무효하면 새 게스트를 만들고 쿠키를 발급
 * 로그인 세션 처리는 5단계(구글 로그인)에서 이 앞에 추가한다.
 */
@Injectable()
export class PlayerGuard implements CanActivate {
  constructor(
    private readonly players: PlayerService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithPlayer>();
    const res = http.getResponse<Response>();
    const secure = this.config.get('COOKIE_SECURE', { infer: true });

    const token = readGuestToken(req);
    const existing = token ? await this.players.findGuest(token) : null;
    if (existing && token) {
      req.player = existing;
      writeGuestCookie(res, token, secure);
      return true;
    }

    const created = await this.players.createGuest();
    req.player = created.player;
    writeGuestCookie(res, created.token, secure);
    return true;
  }
}
