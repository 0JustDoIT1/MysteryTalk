import { z } from 'zod';

/**
 * 사건 데이터 파일(`case.json`) 형식(SPEC §11).
 * 2단계에서는 질문 판정에 필요한 필드와 이후 단계에서 쓸 필드(정답 요소·힌트·해설)를 함께 정의한다.
 * 맵·오브젝트·NPC·단서는 4단계(현장 조사)에서 추가한다.
 */

export const difficultySchema = z.enum(['EASY', 'NORMAL', 'HARD']);
export type Difficulty = z.infer<typeof difficultySchema>;

/** 수위 등급 2단계(PRD D35) */
export const ratingSchema = z.enum(['NORMAL', 'STRONG']);
export type Rating = z.infer<typeof ratingSchema>;

/** 장르(PRD D50). '전체'는 필터 UI의 선택지라 데이터에는 없다. */
export const genreSchema = z.enum(['MYSTERY', 'HORROR', 'CRIME']);
export type Genre = z.infer<typeof genreSchema>;

/** FACT: 확정 사실, PARTIAL: 부분·조건부로만 맞는 사실('그럴 수도' 근거, D2), NEGATIVE: "~가 아니다" */
export const factKindSchema = z.enum(['FACT', 'PARTIAL', 'NEGATIVE']);

export const factSchema = z.object({
  id: z.string().regex(/^F\d{2,3}$/),
  text: z.string().min(1).max(300),
  kind: factKindSchema,
});
export type Fact = z.infer<typeof factSchema>;

/** 수사 자료 탭(PRD D77): 플레이어에게 공개되는 정보만 */
export const caseFileSchema = z.object({
  overview: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1),
  people: z
    .array(
      z.object({
        id: z.string().regex(/^P\d+$/),
        name: z.string().min(1),
        role: z.string().min(1),
        publicInfo: z.string().min(1).max(120),
      }),
    )
    .min(1),
  timeline: z.array(z.object({ at: z.string().min(1), text: z.string().min(1) })),
});
export type CaseFile = z.infer<typeof caseFileSchema>;

/** 정답 요소(PRD §8, D20). 키워드 그룹: 그룹 안은 OR, 그룹 사이는 AND */
export const answerElementSchema = z.object({
  id: z.string().regex(/^A\d+$/),
  description: z.string().min(1),
  required: z.boolean(),
  keywordGroups: z.array(z.array(z.string().min(1)).min(1)).min(1),
});

export const hintSchema = z.object({
  no: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().min(1).max(200),
});

export const caseContentSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    isTutorial: z.boolean(),
    version: z.number().int().positive(),
    title: z.string().min(1).max(40),
    /** 사건 카드의 한 줄 요약 */
    summary: z.string().min(1).max(80),
    /** 첫 진입 시 보여 주는 짧은 도입 이야기 */
    intro: z.string().min(1).max(800),
    caseFile: caseFileSchema,
    difficulty: difficultySchema,
    /** 기준 질문 수 B(PRD D49). 서버 상한은 3B */
    baseQuestions: z.number().int().min(5).max(100),
    rating: ratingSchema,
    tags: z.array(z.string().min(1)).max(8),
    genres: z.array(genreSchema).min(1),
    facts: z.array(factSchema).min(5),
    elements: z.array(answerElementSchema).min(1),
    hints: z.array(hintSchema).length(3),
    explanation: z.string().min(1).max(2000),
    isPublished: z.boolean(),
  })
  .superRefine((c, ctx) => {
    const dup = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    for (const [label, values] of [
      ['fact id', c.facts.map((f) => f.id)],
      ['element id', c.elements.map((e) => e.id)],
      ['person id', c.caseFile.people.map((p) => p.id)],
    ] as const) {
      const d = dup([...values]);
      if (d.length)
        ctx.addIssue({ code: 'custom', message: `duplicate ${label}: ${d.join(', ')}` });
    }
    const hintNos = c.hints.map((h) => h.no).sort();
    if (hintNos.join(',') !== '1,2,3') {
      ctx.addIssue({ code: 'custom', message: 'hints must be numbered 1, 2, 3' });
    }
    if (!c.elements.some((e) => e.required)) {
      ctx.addIssue({ code: 'custom', message: 'at least one required answer element' });
    }
  });
export type CaseContent = z.infer<typeof caseContentSchema>;
