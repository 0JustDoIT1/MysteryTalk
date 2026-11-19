import type { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  // body parser 는 configureApp 에서 크기 제한(16KB)과 함께 등록한다.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  configureApp(app);
  const config = app.get(ConfigService<Env, true>);
  // 브라우저 요청은 Next 서버(/api 프록시)가 연결을 재사용해 보낸다. Node 기본값(5초)이면 백엔드가
  // 쉬는 연결을 닫는 순간 프록시가 같은 연결로 요청을 보내 끊기고, 프록시가 500을 돌려줄 수 있다
  // (2026-11-19 브라우저 E2E에서 직전 요청 5.1초 뒤 프록시 500 관찰). 프록시보다 오래 유지한다.
  const server = app.getHttpServer() as Server;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000; // keepAliveTimeout보다 커야 한다
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
