import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { PlayerController } from './player/player.controller.js';
import { PlayerGuard } from './player/player.guard.js';
import { PlayerService } from './player/player.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 순간 호출 제한(SPEC §10). 일일 질문 한도는 2단계 이후 DB로 따로 센다. 수치는 [미정]이므로 넉넉한 임시값.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
  ],
  controllers: [HealthController, PlayerController],
  providers: [PlayerService, PlayerGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
