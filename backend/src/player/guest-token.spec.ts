import {
  generateGuestToken,
  guestCookieOptions,
  guestTokenMatches,
  hashGuestToken,
  isWellFormedGuestToken,
} from './guest-token.js';

describe('guest-token', () => {
  it('토큰은 base64url 43자이고 매번 다르다', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateGuestToken));
    expect(tokens.size).toBe(100);
    for (const t of tokens) expect(isWellFormedGuestToken(t)).toBe(true);
  });

  it('해시는 SHA-256 hex 64자이고 원문을 포함하지 않는다', () => {
    const token = generateGuestToken();
    const hash = hashGuestToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('맞는 토큰만 일치하고, 깨진 해시에도 예외 없이 false', () => {
    const token = generateGuestToken();
    expect(guestTokenMatches(token, hashGuestToken(token))).toBe(true);
    expect(guestTokenMatches(generateGuestToken(), hashGuestToken(token))).toBe(false);
    expect(guestTokenMatches(token, 'not-hex')).toBe(false);
  });

  it('형식이 틀린 쿠키 값은 거른다', () => {
    for (const bad of [undefined, null, 1, '', 'short', 'A'.repeat(44), `${'A'.repeat(42)}!`]) {
      expect(isWellFormedGuestToken(bad)).toBe(false);
    }
  });

  it('쿠키는 HttpOnly·SameSite=Lax·30일, Secure는 설정을 따른다', () => {
    expect(guestCookieOptions(false)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    expect(guestCookieOptions(true).secure).toBe(true);
  });
});
