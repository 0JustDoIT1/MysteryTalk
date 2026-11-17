import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { updateMeRequestSchema, type MeResponse, type UpdateMeRequest } from '@mysterytalk/shared';
import { AUTH_PROVIDER, type AuthProvider } from '../auth/auth-provider.js';
import { clearSessionCookie } from '../auth/auth-cookies.js';
import { AuthService } from '../auth/auth.service.js';
import type { Env } from '../config/env.js';
import { AppException } from '../common/app-exception.js';
import type { Player } from '../generated/prisma/client.js';
import { CurrentPlayer } from './current-player.decorator.js';
import { clearGuestCookie } from './guest-token.js';
import { PlayerGuard } from './player.guard.js';
import { PlayerService } from './player.service.js';

@Controller('me')
@UseGuards(PlayerGuard)
export class PlayerController {
  constructor(
    private readonly players: PlayerService,
    private readonly auth: AuthService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 현재 플레이어 정보. 쿠키가 없으면 새 게스트가 발급된다. */
  @Get()
  me(@CurrentPlayer() player: Player): MeResponse {
    return { ...this.players.toMe(player), loginAvailable: this.provider.available };
  }

  /** 탐정 이름 변경(PRD D40). 게스트도 바꿀 수 있다. */
  @Patch()
  async update(
    @CurrentPlayer() player: Player,
    @Body({ schema: updateMeRequestSchema }) body: UpdateMeRequest,
  ): Promise<MeResponse> {
    const updated = await this.players.rename(player, body.detectiveName);
    return { ...this.players.toMe(updated), loginAvailable: this.provider.available };
  }

  /** 로그인 사용자의 18세 확인 기록(PRD D33). 기기에서 확인한 사용자가 로그인 직후 호출한다. */
  @Post('age-confirmation')
  @HttpCode(204)
  async confirmAge(@CurrentPlayer() player: Player): Promise<void> {
    if (player.kind !== 'USER') throw new AppException(401, 'UNAUTHORIZED');
    await this.auth.confirmAge(player, new Date());
  }

  /**
   * 계정 삭제(로그인) 또는 이 브라우저의 기록 지우기(게스트)(PRD D95·D96). 즉시 영구 삭제하고 쿠키를 지운다.
   * 이 브라우저는 다음 요청부터 빈 새 게스트가 된다. 연령 확인 기록(로그인 계정)도 함께 지워진다(D97).
   */
  @Delete()
  @HttpCode(204)
  async remove(
    @CurrentPlayer() player: Player,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.players.deleteAll(player);
    const secure = this.config.get('COOKIE_SECURE', { infer: true });
    clearSessionCookie(res, secure);
    clearGuestCookie(res, secure);
  }
}
