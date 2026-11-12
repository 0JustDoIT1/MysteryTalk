import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.js';
import {
  AUTH_PROVIDER,
  FakeAuthProvider,
  GoogleAuthProvider,
  type AuthProvider,
} from './auth/auth-provider.js';
import { AuthService } from './auth/auth.service.js';
import { validateEnv, type Env } from './config/env.js';
import { CasesService } from './game/cases.service.js';
import { ExploreService } from './game/explore.service.js';
import { GameController } from './game/game.controller.js';
import { QuestionsService } from './game/questions.service.js';
import { SessionsService } from './game/sessions.service.js';
import { SubmissionsService } from './game/submissions.service.js';
import { HealthController } from './health/health.controller.js';
import { LimitsService } from './ops/limits.service.js';
import { NoticesController } from './ops/notices.controller.js';
import { GradeModule } from './grade/grade.module.js';
import { JudgeModule } from './judge/judge.module.js';
import { PlayerController } from './player/player.controller.js';
import { PlayerGuard } from './player/player.guard.js';
import { PlayerService } from './player/player.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 순간 호출 제한(SPEC §10). 일일 질문 한도는 7단계에서 DB로 따로 센다. 수치는 [미정]이라 넉넉한 임시값.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    JudgeModule,
    GradeModule,
  ],
  controllers: [
    HealthController,
    PlayerController,
    GameController,
    AuthController,
    NoticesController,
  ],
  providers: [
    PlayerService,
    PlayerGuard,
    AuthService,
    {
      // 로그인 제공자: 구글(실제) 또는 가짜(개발·테스트, 운영 금지 — 환경 변수 검증)
      provide: AUTH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): AuthProvider => {
        const publicBaseUrl = config.get('PUBLIC_BASE_URL', { infer: true });
        return config.get('AUTH_PROVIDER', { infer: true }) === 'fake'
          ? new FakeAuthProvider(publicBaseUrl)
          : new GoogleAuthProvider({
              clientId: config.get('GOOGLE_CLIENT_ID', { infer: true }),
              clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
              publicBaseUrl,
            });
      },
    },
    CasesService,
    SessionsService,
    QuestionsService,
    SubmissionsService,
    ExploreService,
    LimitsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
