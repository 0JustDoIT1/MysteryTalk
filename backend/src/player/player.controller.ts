import { Body, Controller, Get, HttpCode, Inject, Patch, Post, UseGuards } from '@nestjs/common';
import { updateMeRequestSchema, type MeResponse, type UpdateMeRequest } from '@mysterytalk/shared';
import { AUTH_PROVIDER, type AuthProvider } from '../auth/auth-provider.js';
import { AuthService } from '../auth/auth.service.js';
import { AppException } from '../common/app-exception.js';
import type { Player } from '../generated/prisma/client.js';
import { CurrentPlayer } from './current-player.decorator.js';
import { PlayerGuard } from './player.guard.js';
import { PlayerService } from './player.service.js';

@Controller('me')
@UseGuards(PlayerGuard)
export class PlayerController {
  constructor(
    private readonly players: PlayerService,
    private readonly auth: AuthService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
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
}
