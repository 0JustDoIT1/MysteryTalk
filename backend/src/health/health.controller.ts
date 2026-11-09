import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { HealthResponse } from '@mysterytalk/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /** DB 연결까지 확인한다. DB가 응답하지 않으면 503과 degraded 상태를 돌려준다. */
  @Get()
  async check(@Res({ passthrough: true }) res: Pick<Response, 'status'>): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok' };
    } catch (error) {
      // 오류를 삼키지 않고 로그로 남긴다(연결 문자열은 메시지에 포함되지 않음).
      this.logger.error(`DB health check failed: ${(error as Error).message}`);
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'degraded', db: 'error' };
    }
  }
}
