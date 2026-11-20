import { z } from 'zod';
import { exploreContentSchema, exploreIssues } from './explore.js';
import { altSchema, imageNameSchema } from './images.js';

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

/**
 * 등장인물(PRD D101): 이름 없이 호칭만 쓴다. 플레이어에게 목록으로 보여 주지 않고(수사 자료 폐지, D99),
 * 호칭이 겹치거나 서로 포함되지 않는지 검사하는 데만 쓴다.
 */
export const personSchema = z.strictObject({
  id: z.string().regex(/^P\d+$/),
  /** 호칭(예: '조카', '숨진 경비원'). 사실·단서·도입에서 이 말로 부른다 */
  designation: z.string().min(1).max(20),
});
export type Person = z.infer<typeof personSchema>;

/** 정답 요소(PRD §8, D20). 키워드 그룹: 그룹 안은 OR, 그룹 사이는 AND */
export const answerElementSchema = z.object({
  id: z.string().regex(/^A\d+$/),
  description: z.string().min(1),
  required: z.boolean(),
  keywordGroups: z.array(z.array(z.string().min(1)).min(1)).min(1),
});

const hintNoSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/**
 * 힌트(PRD §7): 글 힌트(튜토리얼·샘플) 또는 이미지 힌트(본편, D92). 이미지 힌트는 설명 문장 없이
 * 이미지 한 장이고, 대체 텍스트(alt)는 화면 낭독용이다.
 */
export const hintSchema = z.union([
  z.strictObject({ no: hintNoSchema, text: z.string().min(1).max(200) }),
  z.strictObject({ no: hintNoSchema, image: imageNameSchema, alt: altSchema }),
]);
export type Hint = z.infer<typeof hintSchema>;

/** 힌트의 글(글 힌트) 또는 대체 텍스트(이미지 힌트). 인물 표기 검사·화면 낭독에 쓴다 */
export function hintWords(h: Hint): string {
  return 'text' in h ? h.text : h.alt;
}

/** 사건이 쓰는 이미지 파일 이름(대표 그림·맵 배경·힌트·단서). 적재 때 사건 폴더의 images/에서 읽는다 */
export function caseImageNames(c: {
  cover?: string;
  hints: Hint[];
  clues: { image?: string }[];
  maps?: { background?: string }[];
}): string[] {
  const names = [
    ...(c.cover ? [c.cover] : []),
    ...(c.maps ?? []).flatMap((m) => (m.background ? [m.background] : [])),
    ...c.hints.flatMap((h) => ('image' in h ? [h.image] : [])),
    ...c.clues.flatMap((k) => (k.image ? [k.image] : [])),
  ];
  return [...new Set(names)];
}

export const caseContentSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    isTutorial: z.boolean(),
    version: z.number().int().positive(),
    title: z.string().min(1).max(40),
    /** 사건 카드의 한 줄 요약 */
    summary: z.string().min(1).max(80),
    /** 화면에 보여 주는 짧은 사건 개요(2~4문장, docs/cases/README.md §6) */
    intro: z.string().min(1).max(800),
    /**
     * AI 판정·채점에만 넣는 상세 개요(2026-11-20). 플레이어에게 보이지 않고 공개 API로 내보내지 않는다.
     * 일시·발견 경위·처음 등장하는 인물 등 판정 맥락을 담는다. 없으면 intro를 쓴다.
     */
    background: z.string().min(1).max(1500).optional(),
    /** 사건 번호(PRD D98). 카드에 '사건 01'로 표시한다. 튜토리얼은 0 */
    caseNo: z.number().int().min(0).max(999),
    /** 카드 대표 그림(PRD D98, 선택). images/의 파일 이름, 16:9. 없으면 화면이 장르 색 임시 그림을 그린다 */
    cover: imageNameSchema.optional(),
    people: z.array(personSchema).min(1),
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
    /** 현장 조사(4단계): 맵·조사 대상·NPC·단서 */
    ...exploreContentSchema.shape,
  })
  .superRefine((c, ctx) => {
    const dup = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    for (const [label, values] of [
      ['fact id', c.facts.map((f) => f.id)],
      ['element id', c.elements.map((e) => e.id)],
      ['person id', c.people.map((p) => p.id)],
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
    for (const message of designationIssues(c.people)) ctx.addIssue({ code: 'custom', message });
    for (const message of exploreIssues(c, { factIds: c.facts.map((f) => f.id) }))
      ctx.addIssue({ code: 'custom', message });
  });
export type CaseContent = z.infer<typeof caseContentSchema>;

/** 정답 요소 개수(PRD D100): 처음부터 공개하는 수. 오답 안내의 '3개 중 2개'와 같은 기준(필수 요소) */
export function requiredElementCount(c: { elements: { required: boolean }[] }): number {
  return c.elements.filter((e) => e.required).length;
}

const compact = (v: string) => v.replace(/\s/g, '');

/**
 * 호칭 규칙(PRD D101): 한 사건 안에서 호칭이 겹치거나 한쪽이 다른 쪽을 포함하면 안 된다.
 * 예: '간호사'와 '수간호사'는 "간호사가 ~했나요?"가 누구인지 모호하다 → '당직 간호사'와 '수간호사'.
 */
export function designationIssues(people: { designation: string }[]): string[] {
  const issues: string[] = [];
  const names = people.map((p) => compact(p.designation));
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [names[i]!, names[j]!];
      if (a === b) issues.push(`duplicate person designation: ${people[i]!.designation}`);
      else if (a.includes(b) || b.includes(a))
        issues.push(
          `person designation "${people[i]!.designation}" and "${people[j]!.designation}" overlap`,
        );
    }
  return issues;
}
