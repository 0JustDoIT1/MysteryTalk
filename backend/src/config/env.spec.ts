import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const url = 'postgresql://user:pw@localhost:5434/db';

  it('기본값을 적용한다(판정 AI는 mock이 기본)', () => {
    expect(validateEnv({ DATABASE_URL: url })).toEqual({
      PORT: 4000,
      DATABASE_URL: url,
      COOKIE_SECURE: false,
      TRUST_PROXY: 'loopback',
      LLM_PROVIDER: 'mock',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'gemma3:12b',
      LLM_TIMEOUT_MS: 12000,
    });
  });

  it('판정 AI 설정을 검증한다', () => {
    expect(
      validateEnv({ DATABASE_URL: url, LLM_PROVIDER: 'ollama', LLM_TIMEOUT_MS: '8000' }),
    ).toMatchObject({ LLM_PROVIDER: 'ollama', LLM_TIMEOUT_MS: 8000 });
    expect(() => validateEnv({ DATABASE_URL: url, LLM_PROVIDER: 'gpt' })).toThrow(/LLM_PROVIDER/);
    expect(() => validateEnv({ DATABASE_URL: url, LLM_TIMEOUT_MS: '10' })).toThrow(
      /LLM_TIMEOUT_MS/,
    );
  });

  it('COOKIE_SECURE=true 를 불리언으로 바꾼다', () => {
    expect(validateEnv({ DATABASE_URL: url, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
  });

  it('DATABASE_URL이 없거나 postgres가 아니면 실패한다', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/postgres/);
  });

  it('오류 메시지에 값 자체를 노출하지 않는다', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://u:SUPER_SECRET@h/d' })).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('SUPER_SECRET'),
      }),
    );
  });
});
