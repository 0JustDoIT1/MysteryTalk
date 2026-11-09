import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';

/** 게스트 기록 보관 기간: 마지막 활동 후 30일(PRD D32). 쿠키 만료도 같게 맞춘다. */
export const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const GUEST_COOKIE = 'mt_guest';

/** 32바이트 암호학적 난수(base64url 43자). 원문은 쿠키에만 있고 DB에는 해시만 저장한다. */
export function generateGuestToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashGuestToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** 저장된 해시와 토큰을 상수 시간으로 비교한다. */
export function guestTokenMatches(token: string, storedHash: string): boolean {
  const actual = Buffer.from(hashGuestToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 형식이 맞지 않는 쿠키는 DB를 조회하지 않고 버린다. */
export function isWellFormedGuestToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function guestCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: GUEST_TTL_MS,
  };
}

export function readGuestToken(req: Request): string | null {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[GUEST_COOKIE];
  return isWellFormedGuestToken(value) ? value : null;
}

export function writeGuestCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(GUEST_COOKIE, token, guestCookieOptions(secure));
}
