import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { priceOf } from '../ops/pricing.js';
import { anthropicChat } from './anthropic-client.js';
import { ollamaChatFn, type LlmChat } from './ollama-client.js';

/** LLM_PROVIDER 에 맞는 대화 호출과 모델 이름(판정·채점 공용). mock 이면 null */
export function chatFromConfig(
  config: ConfigService<Env, true>,
): { model: string; chat: LlmChat } | null {
  const provider = config.get('LLM_PROVIDER', { infer: true });
  const timeoutMs = config.get('LLM_TIMEOUT_MS', { infer: true });
  if (provider === 'ollama') {
    const model = config.get('OLLAMA_MODEL', { infer: true });
    const baseUrl = config.get('OLLAMA_BASE_URL', { infer: true });
    return { model, chat: ollamaChatFn({ baseUrl, model, timeoutMs }) };
  }
  if (provider === 'anthropic') {
    const model = config.get('ANTHROPIC_MODEL', { infer: true });
    const apiKey = config.get('ANTHROPIC_API_KEY', { infer: true })!;
    priceOf(model); // 단가표에 없는 클라우드 모델이면 시작할 때 막는다(월 예산 계산, D46)
    return { model, chat: anthropicChat({ apiKey, model, timeoutMs }) };
  }
  return null;
}
