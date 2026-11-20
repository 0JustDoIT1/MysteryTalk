import { z } from 'zod';

export const playerKindSchema = z.enum(['GUEST', 'USER']);
export type PlayerKind = z.infer<typeof playerKindSchema>;

/** 탐정 이름 기본값(PRD D40). 이름은 화면 고정 문구에만 쓰고 AI에 전달하지 않는다. */
export const DEFAULT_DETECTIVE_NAME = '탐정';

/**
 * 탐정 캐릭터 2종(PRD D103): 사설탐정(noir)과 강력계 형사(inspector). 화면 표시 이름은 '탐정'·'형사'(2026-11-20). 그림은 frontend/public/sprites/detectives/<id>.png(걷기 3프레임 × 4방향, 한 칸 64px).
 * 화면 표시에만 쓰고 AI에 전달하지 않는다.
 */
export const DETECTIVE_CHARACTERS = ['noir', 'inspector'] as const;
export const detectiveCharacterSchema = z.enum(DETECTIVE_CHARACTERS);
export type DetectiveCharacter = z.infer<typeof detectiveCharacterSchema>;
/** 고르지 않았을 때 쓰는 캐릭터 */
export const DEFAULT_DETECTIVE_CHARACTER: DetectiveCharacter = 'noir';

/** GET /me 응답(SPEC §5). 내부 식별자·토큰은 내보내지 않는다. */
export const meResponseSchema = z.object({
  kind: playerKindSchema,
  detectiveName: z.string(),
  /** 고른 탐정 캐릭터(D103). 아직 고르지 않았으면 null(화면은 기본 캐릭터로 그리고 '탐정 정하기' 창을 띄운다) */
  detectiveCharacter: detectiveCharacterSchema.nullable(),
  ageConfirmed: z.boolean(),
  /** 로그인을 쓸 수 있는지(구글 설정이 없으면 false) */
  loginAvailable: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** 탐정 이름 길이(PRD D40) */
export const DETECTIVE_NAME_MIN = 1;
export const DETECTIVE_NAME_MAX = 12;

/** PATCH /me: 탐정 이름·캐릭터 변경(둘 중 하나 이상). 화면 표시에만 쓰고 AI에 전달하지 않는다(D40·D103). */
export const updateMeRequestSchema = z
  .object({
    detectiveName: z.string().max(100).optional(),
    detectiveCharacter: detectiveCharacterSchema.optional(),
  })
  .refine((v) => v.detectiveName !== undefined || v.detectiveCharacter !== undefined, {
    message: 'detectiveName or detectiveCharacter is required',
  });
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;
