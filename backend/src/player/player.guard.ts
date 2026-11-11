import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { readSessionToken, writeSessionCookie } from '../auth/auth-cookies.js';
import { AuthService } from '../auth/auth.service.js';
import type { Env } from '../config/env.js';
import type { Player } from '../generated/prisma/client.js';
import { readGuestToken, writeGuestCookie } from './guest-token.js';
import { PlayerService } from './player.service.js';

export type RequestWithPlayer = Request & { player: Player };

/**
 * 요청의 플레이어를 확정한다(SPEC §3.1).
 * - 유효한 로그인 세션이 있으면 그 사용자(세션 쿠키 만료 연장)
 * - 아니면 유효한 게스트 쿠키의 플레이어(쿠키 만료 연장)
 * - 둘 다 없거나 무효하면 새 게스트를 만들고 쿠키를 발급
 */
@Injectable()
export class PlayerGuard implements CanActivate {
  constructor(
    private readonly players: PlayerService,
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithPlayer>();
    const res = http.getResponse<Response>();
    const secure = this.config.get('COOKIE_SECURE', { infer: true });

    const sessionToken = readSessionToken(req);
    const user = sessionToken ? await this.auth.findSessionUser(sessionToken) : null;
    if (user && sessionToken) {
      req.player = user;
      writeSessionCookie(res, sessionToken, secure);
      return true;
    }

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
