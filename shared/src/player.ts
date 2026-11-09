import { z } from 'zod';

export const playerKindSchema = z.enum(['GUEST', 'USER']);
export type PlayerKind = z.infer<typeof playerKindSchema>;

/** 탐정 이름 기본값(PRD D40). 이름은 화면 고정 문구에만 쓰고 AI에 전달하지 않는다. */
export const DEFAULT_DETECTIVE_NAME = '탐정';

/** GET /me 응답(SPEC §5). 내부 식별자·토큰은 내보내지 않는다. */
export const meResponseSchema = z.object({
  kind: playerKindSchema,
  detectiveName: z.string(),
  ageConfirmed: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
