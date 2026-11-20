import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { JUDGE, type Judge } from './judge.types.js';
import { LlmJudge } from './llm.judge.js';
import { chatFromConfig } from './llm-provider.js';
import { MockJudge } from './mock.judge.js';

@Global()
@Module({
  providers: [
    {
      provide: JUDGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Judge => {
        const llm = chatFromConfig(config);
        return llm ? new LlmJudge(llm) : new MockJudge();
      },
    },
  ],
  exports: [JUDGE],
})
export class JudgeModule {}
