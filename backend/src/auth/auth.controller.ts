import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { GUEST_COOKIE, readGuestToken } from '../player/guest-token.js';
import { PlayerService } from '../player/player.service.js';
import {
  clearFlowCookie,
  clearSessionCookie,
  readFlowCookie,
  readSessionToken,
  writeFlowCookie,
  writeSessionCookie,
} from './auth-cookies.js';
import { AUTH_PROVIDER, callbackUrlFor, type AuthProvider } from './auth-provider.js';
import { AuthService } from './auth.service.js';

/**
 * 구글 로그인(SPEC §3, §5): 시작 → 구글 → 콜백(기록 이전·세션 발급) → 메인으로.
 * 브라우저는 같은 출처의 /api/auth/* 로 접근한다(Next 프록시). 결과는 ?login=ok|failed|unavailable 로 알린다.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly players: PlayerService,
    private readonly config: ConfigService<Env, true>,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
  ) {}

  private get secure(): boolean {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }

  private back(res: Response, result: 'ok' | 'failed' | 'unavailable'): void {
    const url = new URL('/', this.config.get('PUBLIC_BASE_URL', { infer: true }));
    url.searchParams.set('login', result);
    res.redirect(302, url.toString());
  }

  @Get('google')
  async start(@Res() res: Response, @Query('fakeSub') fakeSub?: string): Promise<void> {
    if (!this.provider.available) return this.back(res, 'unavailable');
    try {
      const { url, flow } = await this.provider.start({ fakeSub });
      writeFlowCookie(res, flow, this.secure);
      res.redirect(302, url);
    } catch {
      this.back(res, 'failed');
    }
  }

  @Get('google/callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const flow = readFlowCookie(req);
    clearFlowCookie(res, this.secure);
    if (!flow) return this.back(res, 'failed');
    // 공개 주소 기준 콜백 URL(프록시 뒤라 요청 경로는 /auth/google/callback 이다)
    const callbackUrl = new URL(
      callbackUrlFor(this.config.get('PUBLIC_BASE_URL', { infer: true })),
    );
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') callbackUrl.searchParams.set(k, v);
    }
    const result = await this.provider.finish(callbackUrl, flow);
    if (!result) return this.back(res, 'failed');

    const guestToken = readGuestToken(req);
    const guest = guestToken ? await this.players.findGuest(guestToken) : null;
    const { token } = await this.auth.login(result.sub, guest);
    writeSessionCookie(res, token, this.secure);
    // 게스트 기록은 계정으로 옮겼으므로 게스트 쿠키는 지운다.
    res.clearCookie(GUEST_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: '/',
    });
    this.back(res, 'ok');
  }

  /** 로그아웃: 세션을 지운다. 이 브라우저는 다음 요청부터 빈 새 게스트가 된다(기록은 계정에 남음). */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = readSessionToken(req);
    if (token) await this.auth.logout(token);
    clearSessionCookie(res, this.secure);
  }
}
