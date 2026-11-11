import { describe, expect, it, vi } from 'vitest';
import { healthResponseSchema, meResponseSchema } from '@mysterytalk/shared';
import { ApiError, apiGet, apiOrThrow, apiRequest, isRetryable } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiGet', () => {
  it('성공 응답을 스키마로 검증해 돌려준다', async () => {
    const f = vi.fn().mockResolvedValue(
      json(200, {
        kind: 'GUEST',
        detectiveName: '탐정',
        ageConfirmed: false,
        loginAvailable: true,
      }),
    );
    const r = await apiGet('/me', meResponseSchema, f);
    expect(r).toEqual({
      ok: true,
      status: 200,
      data: { kind: 'GUEST', detectiveName: '탐정', ageConfirmed: false, loginAvailable: true },
    });
    expect(f).toHaveBeenCalledWith('/api/me', {
      method: 'GET',
      headers: {},
      body: undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('서버 오류 코드는 고정 문구로 바꾼다', async () => {
    const f = vi.fn().mockResolvedValue(json(404, { code: 'NOT_FOUND', message: 'server text' }));
    const r = await apiGet('/x', meResponseSchema, f);
    expect(r).toMatchObject({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: '요청한 내용을 찾을 수 없어요.',
    });
  });

  it('503 degraded 처럼 오류 형식이 아닌 본문은 스키마로 검증한다', async () => {
    const f = vi.fn().mockResolvedValue(json(503, { status: 'degraded', db: 'error' }));
    const r = await apiGet('/health', healthResponseSchema, f);
    expect(r).toEqual({ ok: true, status: 503, data: { status: 'degraded', db: 'error' } });
  });

  it('스키마에 맞지 않으면 INVALID_RESPONSE', async () => {
    const f = vi.fn().mockResolvedValue(json(200, { kind: 'ALIEN' }));
    expect(await apiGet('/me', meResponseSchema, f)).toMatchObject({
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });

  it('네트워크 오류는 NETWORK', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    expect(await apiGet('/me', meResponseSchema, f)).toMatchObject({
      ok: false,
      status: 0,
      code: 'NETWORK',
    });
  });
});

describe('apiRequest (상태 변경 요청)', () => {
  it('본문은 JSON으로, 멱등성 키는 헤더로 보낸다', async () => {
    const f = vi.fn().mockResolvedValue(
      json(200, {
        kind: 'GUEST',
        detectiveName: '탐정',
        ageConfirmed: false,
        loginAvailable: true,
      }),
    );
    await apiRequest(
      '/sessions/s/questions',
      meResponseSchema,
      { method: 'POST', body: { question: '질문' }, idempotencyKey: 'k-1' },
      f,
    );
    expect(f).toHaveBeenCalledWith('/api/sessions/s/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'k-1' },
      body: JSON.stringify({ question: '질문' }),
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('apiOrThrow 는 실패를 ApiError 로 던지고, 판정 지연·네트워크만 재시도 대상이다', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(json(503, { code: 'AI_UNAVAILABLE', message: 'x' })) as typeof fetch;
    try {
      const error = await apiOrThrow('/x', meResponseSchema).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(isRetryable(error)).toBe(true);
      expect(isRetryable(new ApiError('SESSION_FINISHED', 409, ''))).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });
});
