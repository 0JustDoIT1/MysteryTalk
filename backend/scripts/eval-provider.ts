import { anthropicChat } from '../src/judge/anthropic-client.js';
import { ollamaChatFn, type LlmChat } from '../src/judge/ollama-client.js';

/**
 * 평가 스크립트 공용: --provider 에 맞는 대화 호출과 모델 이름.
 * ollama(기본): 로컬 Ollama. anthropic: Claude API(ANTHROPIC_API_KEY 필요, 기본 모델 claude-haiku-5-5).
 */
export function chatFromArgs(values: {
  provider?: string;
  model?: string;
  'base-url'?: string;
  'timeout-ms'?: string;
}): { model: string; chat: LlmChat } {
  const provider = values.provider ?? 'ollama';
  const timeoutMs = Number(values['timeout-ms'] ?? '60000');
  if (provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for --provider anthropic');
    const model = values.model ?? process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-5-5';
    return { model, chat: anthropicChat({ apiKey, model, timeoutMs }) };
  }
  if (provider !== 'ollama') throw new Error(`unknown provider: ${provider}`);
  const model = values.model ?? process.env['OLLAMA_MODEL'] ?? 'gemma3:12b';
  const baseUrl = values['base-url'] ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
  return { model, chat: ollamaChatFn({ baseUrl, model, timeoutMs }) };
}
