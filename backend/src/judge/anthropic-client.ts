import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import type { ChatRequest, LlmChat, LlmReply } from './ollama-client.js';

/**
 * Claude(Messages API) 호출을 LlmChat 으로 감싼다(PRD D45, 배포용 클라우드 AI 후보).
 * - 구조화 출력: output_config.format(JSON 스키마). maxLength·maxItems 처럼 지원하지 않는 제약은
 *   SDK 도우미가 설명으로 바꿔 보내고, 길이·개수 검증은 호출하는 쪽 파서가 그대로 한다.
 * - Haiku 5.5 는 temperature 등 샘플링 값을 받지 않고 생각(thinking)이 늘 켜져 있어 effort 로 깊이를 낮춘다.
 * - 캐싱: 시스템 프롬프트와 사용자 메시지의 고정 앞부분(사건 소개·사실 목록·정답 요소)에 캐시를 건다.
 *   사용자 메시지는 마지막 '플레이어 질문/답안' 단락부터 바뀌므로 그 앞에서 자른다.
 * - SDK 자동 재시도는 끈다(재시도는 판정기·채점기가 1회 한다).
 */
export type AnthropicOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  effort?: 'low' | 'medium' | 'high';
  /** 테스트용 */
  client?: Pick<Anthropic, 'messages'>;
};

/** 사용자 메시지에서 바뀌는 부분이 시작되는 표시(prompt.ts·grade-prompt.ts·positive-check.ts 공통) */
const VARIABLE_PART = '\n\n플레이어 ';

type TextBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

export function splitForCache(user: string): TextBlock[] {
  const cut = user.lastIndexOf(VARIABLE_PART);
  if (cut <= 0) return [{ type: 'text', text: user }];
  return [
    { type: 'text', text: user.slice(0, cut), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: user.slice(cut + 2) },
  ];
}

export function anthropicChat(options: AnthropicOptions): LlmChat {
  const client =
    options.client ??
    new Anthropic({ apiKey: options.apiKey, maxRetries: 0, timeout: options.timeoutMs });
  return async (request: ChatRequest): Promise<LlmReply> => {
    const started = Date.now();
    try {
      const res = await client.messages.create({
        model: options.model,
        // 생각 토큰도 출력에 포함되므로 JSON 길이(numPredict)보다 넉넉히 둔다
        max_tokens: Math.max(2048, request.numPredict * 4),
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: splitForCache(request.user) }],
        output_config: {
          effort: options.effort ?? 'low',
          format: jsonSchemaOutputFormat(request.format as { type: 'object' }),
        },
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const u = res.usage;
      return {
        ok: true,
        content: text,
        latencyMs: Date.now() - started,
        // 캐시 읽기·쓰기도 입력으로 센다(비용 추정은 보수적으로 전체 입력 단가를 쓴다)
        tokensIn:
          u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        tokensOut: u.output_tokens,
      };
    } catch (error) {
      // 원인 진단용으로 오류 종류·상태 코드만 남긴다(키·질문 내용은 남기지 않는다)
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      console.warn(`[anthropic] ${(error as Error).name}${status ? ` ${status}` : ''}`);
      return {
        ok: false,
        reason: error instanceof Anthropic.APIConnectionTimeoutError ? 'timeout' : 'unreachable',
        latencyMs: Date.now() - started,
      };
    }
  };
}
