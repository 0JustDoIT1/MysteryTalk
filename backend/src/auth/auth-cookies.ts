import type { CookieOptions, Request, Response } from 'express';
import { isWellFormedGuestToken } from '../player/guest-token.js';

/** 로그인 세션: 30일, 쓰면 연장(SPEC §3.1). 토큰 형식·해시는 게스트 토큰과 같다. */
export const SESSION_COOKIE = 'mt_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 구글 로그인 진행 중 상태(state·PKCE·nonce). 10분만 유효 */
export const FLOW_COOKIE = 'mt_oauth';
const FLOW_TTL_MS = 10 * 60 * 1000;

const base = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure,
  path: '/',
});

export function readSessionToken(req: Request): string | null {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
  return isWellFormedGuestToken(value) ? value : null;
}

export function writeSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, { ...base(secure), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, base(secure));
}

export type LoginFlow = { state: string; verifier: string | null; nonce: string | null };

export function writeFlowCookie(res: Response, flow: LoginFlow, secure: boolean): void {
  res.cookie(FLOW_COOKIE, Buffer.from(JSON.stringify(flow)).toString('base64url'), {
    ...base(secure),
    maxAge: FLOW_TTL_MS,
  });
}

export function readFlowCookie(req: Request): LoginFlow | null {
  const raw: unknown = (req.cookies as Record<string, unknown> | undefined)?.[FLOW_COOKIE];
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<LoginFlow>;
    if (typeof v.state !== 'string') return null;
    return {
      state: v.state,
      verifier: typeof v.verifier === 'string' ? v.verifier : null,
      nonce: typeof v.nonce === 'string' ? v.nonce : null,
    };
  } catch {
    return null;
  }
}

export function clearFlowCookie(res: Response, secure: boolean): void {
  res.clearCookie(FLOW_COOKIE, base(secure));
}
