/**
 * Ollama /api/chat 호출 공통부(판정·채점 공용). 구조화 출력(format=JSON 스키마), 생각 모드 끔, temperature 0.
 * 응답 검증은 호출하는 쪽이 한다.
 */
export type OllamaOptions = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type OllamaReply =
  | {
      ok: true;
      content: string;
      latencyMs: number;
      tokensIn: number | null;
      tokensOut: number | null;
    }
  | { ok: false; reason: 'timeout' | 'unreachable'; latencyMs: number };

type OllamaChatResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

export async function ollamaChat(
  options: OllamaOptions,
  request: { system: string; user: string; format: object; numPredict: number },
): Promise<OllamaReply> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  try {
    const res = await fetchImpl(`${options.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs),
      body: JSON.stringify({
        model: options.model,
        stream: false,
        think: false,
        format: request.format,
        keep_alive: '10m',
        options: { temperature: 0, num_predict: request.numPredict, num_ctx: 4096 },
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) return { ok: false, reason: 'unreachable', latencyMs };
    const body = (await res.json()) as OllamaChatResponse;
    return {
      ok: true,
      content: body.message?.content ?? '',
      latencyMs,
      tokensIn: body.prompt_eval_count ?? null,
      tokensOut: body.eval_count ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: (error as Error).name === 'TimeoutError' ? 'timeout' : 'unreachable',
      latencyMs: Date.now() - started,
    };
  }
}
