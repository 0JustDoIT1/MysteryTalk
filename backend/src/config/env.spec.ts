import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const url = 'postgresql://user:pw@localhost:5434/db';

  it('기본값을 적용한다(PORT 4000, COOKIE_SECURE false, TRUST_PROXY loopback)', () => {
    expect(validateEnv({ DATABASE_URL: url })).toEqual({
      PORT: 4000,
      DATABASE_URL: url,
      COOKIE_SECURE: false,
      TRUST_PROXY: 'loopback',
    });
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
