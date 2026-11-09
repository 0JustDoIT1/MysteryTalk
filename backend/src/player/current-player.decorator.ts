import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Player } from '../generated/prisma/client.js';
import type { RequestWithPlayer } from './player.guard.js';

/** PlayerGuard 가 확정한 플레이어를 꺼낸다. 가드 없이 쓰면 안 된다. */
export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Player =>
    ctx.switchToHttp().getRequest<RequestWithPlayer>().player,
);
