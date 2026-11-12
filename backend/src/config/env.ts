import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((v) => v === 'true');

/** 서버 시작 시 환경 변수를 검증한다. 누락·형식 오류면 즉시 실패시킨다. */
export const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
        message: 'DATABASE_URL must be a postgres connection string',
      }),
    /** 운영(HTTPS)에서는 true. 쿠키에 Secure 속성을 붙인다. */
    COOKIE_SECURE: booleanString,
    /** Express `trust proxy`. Next.js rewrites 뒤에서 실제 클라이언트 IP를 얻기 위해 필요하다. */
    TRUST_PROXY: z.string().min(1).default('loopback'),
    /** 판정 AI. mock 은 모든 질문에 IRRELEVANT(개발·CI용), ollama 는 로컬 Ollama(PRD D45) */
    LLM_PROVIDER: z.enum(['mock', 'ollama']).default('mock'),
    OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
    OLLAMA_MODEL: z.string().min(1).default('gemma3:12b'),
    /** AI 호출 1회 타임아웃. 재시도 1회 포함 최대 2배 + 여유가 처리 중 선점 시간이 된다. */
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
    NODE_ENV: z.string().default('development'),
    /**
     * 로그인 제공자(PRD D30). google: 실제 구글 로그인(GOOGLE_CLIENT_ID·SECRET 필요, 없으면 로그인 비활성).
     * fake: 개발·테스트용 가짜 로그인. 운영(NODE_ENV=production)에서는 쓸 수 없다.
     */
    AUTH_PROVIDER: z.enum(['google', 'fake']).default('google'),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /** 브라우저가 접속하는 주소(프론트). 구글 로그인 리디렉션 주소 = PUBLIC_BASE_URL + /api/auth/google/callback */
    PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
    /**
     * 일일 질문 한도(PRD D58·D83). 수치는 [잠정]이라 비용 측정 후 조정한다. 0이면 제한 없음.
     * 게스트는 IP 단위, 로그인은 계정 단위. 튜토리얼은 IP·계정 한도에서 빼고 따로 센다.
     */
    DAILY_LIMIT_GUEST: z.coerce.number().int().min(0).default(60),
    DAILY_LIMIT_USER: z.coerce.number().int().min(0).default(200),
    DAILY_LIMIT_TUTORIAL: z.coerce.number().int().min(0).default(60),
    /** 월 AI 예산(원, PRD D46·D72, [잠정]). 이 중 예비 비율만큼은 정답 채점 전용. 0이면 제한 없음. */
    MONTHLY_AI_BUDGET_KRW: z.coerce.number().int().min(0).default(5000),
    BUDGET_RESERVE_RATIO: z.coerce.number().min(0).max(0.9).default(0.1),
    /** IP 해시용 비밀값(SPEC §10). 운영에서는 반드시 바꾼다. IP 원문은 저장하지 않는다. */
    IP_HASH_SECRET: z.string().min(16).default('dev-only-ip-hash-secret-change-me'),
  })
  .refine((e) => !(e.AUTH_PROVIDER === 'fake' && e.NODE_ENV === 'production'), {
    message: 'AUTH_PROVIDER=fake is not allowed in production',
    path: ['AUTH_PROVIDER'],
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    // 값 자체는 출력하지 않는다(비밀 노출 방지). 키와 사유만 보여준다.
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  return parsed.data;
}
