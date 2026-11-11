import * as oidc from 'openid-client';
import type { LoginFlow } from './auth-cookies.js';

/**
 * 로그인 제공자(PRD D30). 구글 로그인은 OpenID Connect(인가 코드 + PKCE + state + nonce).
 * 개인정보를 줄이려고 scope 는 openid 만 요청한다(이메일·이름을 받지 않음, D37).
 */
export interface AuthProvider {
  readonly available: boolean;
  start(options: { fakeSub?: string }): Promise<{ url: string; flow: LoginFlow }>;
  /** 콜백 URL(공개 주소 기준)과 저장해 둔 상태로 사용자 식별자(sub)를 얻는다. 실패하면 null */
  finish(callbackUrl: URL, flow: LoginFlow): Promise<{ sub: string } | null>;
}

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

export function callbackUrlFor(publicBaseUrl: string): string {
  return new URL('/api/auth/google/callback', publicBaseUrl).toString();
}

export class GoogleAuthProvider implements AuthProvider {
  private config: Promise<oidc.Configuration> | null = null;

  constructor(
    private readonly options: {
      clientId: string | undefined;
      clientSecret: string | undefined;
      publicBaseUrl: string;
    },
  ) {}

  get available(): boolean {
    return Boolean(this.options.clientId && this.options.clientSecret);
  }

  private configuration(): Promise<oidc.Configuration> {
    this.config ??= oidc
      .discovery(
        new URL('https://accounts.google.com'),
        this.options.clientId!,
        this.options.clientSecret!,
      )
      .catch((error: unknown) => {
        this.config = null; // 다음 요청에서 다시 시도
        throw error;
      });
    return this.config;
  }

  async start(): Promise<{ url: string; flow: LoginFlow }> {
    const config = await this.configuration();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrlFor(this.options.publicBaseUrl),
      scope: 'openid',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      state,
      nonce,
      prompt: 'select_account',
    });
    return { url: url.toString(), flow: { state, verifier, nonce } };
  }

  async finish(callbackUrl: URL, flow: LoginFlow): Promise<{ sub: string } | null> {
    if (!flow.verifier || !flow.nonce) return null;
    try {
      const tokens = await oidc.authorizationCodeGrant(await this.configuration(), callbackUrl, {
        pkceCodeVerifier: flow.verifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
      });
      const sub = tokens.claims()?.sub;
      return sub ? { sub: `google|${sub}` } : null;
    } catch {
      return null;
    }
  }
}

/**
 * 개발·테스트용 가짜 로그인(실제 구글에 접속하지 않음). 운영에서는 환경 변수 검증으로 막는다.
 * /auth/google?fakeSub=alice 처럼 사용자를 고를 수 있다(기본 fake-user).
 */
export class FakeAuthProvider implements AuthProvider {
  readonly available = true;

  constructor(private readonly publicBaseUrl: string) {}

  start(options: { fakeSub?: string }): Promise<{ url: string; flow: LoginFlow }> {
    const sub = /^[a-z0-9-]{1,40}$/.test(options.fakeSub ?? '') ? options.fakeSub! : 'fake-user';
    const state = oidc.randomState();
    const url = new URL(callbackUrlFor(this.publicBaseUrl));
    url.searchParams.set('code', `fake:${sub}`);
    url.searchParams.set('state', state);
    return Promise.resolve({ url: url.toString(), flow: { state, verifier: null, nonce: null } });
  }

  finish(callbackUrl: URL, flow: LoginFlow): Promise<{ sub: string } | null> {
    const code = callbackUrl.searchParams.get('code') ?? '';
    const ok = callbackUrl.searchParams.get('state') === flow.state && code.startsWith('fake:');
    return Promise.resolve(ok ? { sub: `fake|${code.slice(5)}` } : null);
  }
}
