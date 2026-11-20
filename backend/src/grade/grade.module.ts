import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { chatFromConfig } from '../judge/llm-provider.js';
import { GRADER, type Grader } from './grader.types.js';
import { LlmGrader } from './llm.grader.js';
import { MockGrader } from './mock.grader.js';

/** 채점 AI 선택. 판정과 같은 LLM_PROVIDER·모델 설정을 쓴다. */
@Global()
@Module({
  providers: [
    {
      provide: GRADER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Grader => {
        const llm = chatFromConfig(config);
        return llm ? new LlmGrader(llm) : new MockGrader();
      },
    },
  ],
  exports: [GRADER],
})
export class GradeModule {}
