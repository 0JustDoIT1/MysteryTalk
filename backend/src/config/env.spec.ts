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
      NODE_ENV: 'development',
      AUTH_PROVIDER: 'google',
      PUBLIC_BASE_URL: 'http://localhost:3000',
      DAILY_LIMIT_GUEST: 60,
      DAILY_LIMIT_USER: 200,
      DAILY_LIMIT_TUTORIAL: 60,
      MONTHLY_AI_BUDGET_KRW: 5000,
      BUDGET_RESERVE_RATIO: 0.1,
      IP_HASH_SECRET: 'dev-only-ip-hash-secret-change-me',
    });
  });

  it('가짜 로그인은 운영(NODE_ENV=production)에서 쓸 수 없다', () => {
    expect(validateEnv({ DATABASE_URL: url, AUTH_PROVIDER: 'fake' }).AUTH_PROVIDER).toBe('fake');
    expect(() =>
      validateEnv({ DATABASE_URL: url, AUTH_PROVIDER: 'fake', NODE_ENV: 'production' }),
    ).toThrow(/AUTH_PROVIDER=fake is not allowed in production/);
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
