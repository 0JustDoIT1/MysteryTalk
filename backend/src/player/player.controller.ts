import { Controller, Get, UseGuards } from '@nestjs/common';
import type { MeResponse } from '@mysterytalk/shared';
import type { Player } from '../generated/prisma/client.js';
import { CurrentPlayer } from './current-player.decorator.js';
import { PlayerGuard } from './player.guard.js';
import { PlayerService } from './player.service.js';

@Controller('me')
@UseGuards(PlayerGuard)
export class PlayerController {
  constructor(private readonly players: PlayerService) {}

  /** 현재 플레이어 정보. 쿠키가 없으면 새 게스트가 발급된다. */
  @Get()
  me(@CurrentPlayer() player: Player): MeResponse {
    return this.players.toMe(player);
  }
}
