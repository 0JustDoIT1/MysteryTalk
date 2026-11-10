import type { Fact } from '@mysterytalk/shared';
import { OllamaJudge } from './ollama.judge.js';

const facts: Fact[] = [{ id: 'F01', kind: 'FACT', text: '열쇠는 세탁소에 있다.' }];
const input = { intro: '도입', facts, question: '열쇠는 세탁소에 있나요?' };

function reply(content: string): Response {
  return new Response(
    JSON.stringify({ message: { content }, prompt_eval_count: 500, eval_count: 20 }),
    {
      status: 200,
    },
  );
}
const good = JSON.stringify({ label: 'YES', retryReason: 'NONE', factIds: ['F01'] });

function judgeWith(fetchImpl: typeof fetch) {
  return new OllamaJudge({
    baseUrl: 'http://ollama',
    model: 'test-model',
    timeoutMs: 1000,
    fetchImpl,
  });
}

describe('OllamaJudge', () => {
  it('구조화 출력·생각 모드 끔·temperature 0으로 요청하고 결과를 검증해 돌려준다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(good));
    const outcome = await judgeWith(fetchImpl).judge(input);

    expect(outcome).toMatchObject({ ok: true, result: { label: 'YES', factIds: ['F01'] } });
    expect(outcome.calls).toEqual([
      expect.objectContaining({ model: 'test-model', tokensIn: 500, tokensOut: 20, ok: true }),
    ]);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://ollama/api/chat');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      model: 'test-model',
      stream: false,
      think: false,
      options: { temperature: 0 },
    });
    expect(body.format.properties.label.enum).toContain('MAYBE');
    expect(body.messages[1].content).toContain('<question>열쇠는 세탁소에 있나요?</question>');
  });

  it('형식 위반이면 1회 재시도한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply('not json'))
      .mockResolvedValueOnce(reply(good));
    const outcome = await judgeWith(fetchImpl).judge(input);
    expect(outcome.ok).toBe(true);
    expect(outcome.calls.map((c) => c.ok)).toEqual([false, true]);
  });

  it('두 번 모두 형식 위반이면 invalid_output 실패', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(() => Promise.resolve(reply('{"label":"PROBABLY"}')));
    expect(await judgeWith(fetchImpl).judge(input)).toMatchObject({
      ok: false,
      reason: 'invalid_output',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('타임아웃이 반복되면 timeout 실패', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const fetchImpl = vi.fn().mockRejectedValue(timeout);
    expect(await judgeWith(fetchImpl).judge(input)).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('서버 오류 응답은 unreachable 실패', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('boom', { status: 500 })));
    expect(await judgeWith(fetchImpl).judge(input)).toMatchObject({
      ok: false,
      reason: 'unreachable',
    });
  });
});
