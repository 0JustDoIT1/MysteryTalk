import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((v) => v === 'true');

/** 서버 시작 시 환경 변수를 검증한다. 누락·형식 오류면 즉시 실패시킨다. */
export const envSchema = z.object({
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
