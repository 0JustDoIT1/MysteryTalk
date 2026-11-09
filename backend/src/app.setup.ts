import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppException } from './common/app-exception.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import type { Env } from './config/env.js';

/** 운영 서버와 테스트가 같은 설정을 쓰도록 앱 공통 설정을 한곳에 둔다. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<Env, true>);
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '16kb' });
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: () => new AppException(422, 'INVALID_INPUT'),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
