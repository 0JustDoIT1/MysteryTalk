import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { GRADER, type Grader } from './grader.types.js';
import { MockGrader } from './mock.grader.js';
import { OllamaGrader } from './ollama.grader.js';

/** 채점 AI 선택. 판정과 같은 LLM_PROVIDER·모델 설정을 쓴다. */
@Global()
@Module({
  providers: [
    {
      provide: GRADER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Grader =>
        config.get('LLM_PROVIDER', { infer: true }) === 'ollama'
          ? new OllamaGrader({
              baseUrl: config.get('OLLAMA_BASE_URL', { infer: true }),
              model: config.get('OLLAMA_MODEL', { infer: true }),
              timeoutMs: config.get('LLM_TIMEOUT_MS', { infer: true }),
            })
          : new MockGrader(),
    },
  ],
  exports: [GRADER],
})
export class GradeModule {}
