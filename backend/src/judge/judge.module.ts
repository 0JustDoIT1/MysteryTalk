import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { JUDGE, type Judge } from './judge.types.js';
import { MockJudge } from './mock.judge.js';
import { OllamaJudge } from './ollama.judge.js';

@Global()
@Module({
  providers: [
    {
      provide: JUDGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Judge =>
        config.get('LLM_PROVIDER', { infer: true }) === 'ollama'
          ? new OllamaJudge({
              baseUrl: config.get('OLLAMA_BASE_URL', { infer: true }),
              model: config.get('OLLAMA_MODEL', { infer: true }),
              timeoutMs: config.get('LLM_TIMEOUT_MS', { infer: true }),
            })
          : new MockJudge(),
    },
  ],
  exports: [JUDGE],
})
export class JudgeModule {}
