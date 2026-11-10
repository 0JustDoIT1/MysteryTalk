import { z } from 'zod';

/**
 * 현장 조사 데이터(SPEC §9.2, §11, PRD §6). 사건 데이터 파일(`case.json`)의 maps·objects·npcs·clues.
 *
 * 맵은 글자 격자로 쓴다(4단계 결정): '#' 벽(지나갈 수 없음), '.' 바닥.
 * 조사 대상·NPC·출입구는 좌표로 따로 둔다. 그림(타일·스프라이트)은 에셋이 정해지면 같은 데이터로 그린다.
 */
export const MAP_WALL = '#';
export const MAP_FLOOR = '.';

const pointSchema = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) });
export type Point = z.infer<typeof pointSchema>;

/** 구역(= 맵) 해금 조건(PRD D26, D74) */
export const mapUnlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('OPEN') }),
  /** 단서를 얻으면 열린다(서버가 결정적으로 판단) */
  z.object({ type: z.literal('CLUE'), clue: z.string() }),
  /**
   * AI가 이 사실을 근거로 '예'라고 판정하고, 질문이 키워드 그룹(그룹 안 OR, 그룹 사이 AND)을 통과하면 열린다.
   * 연결된 힌트를 열어도 열린다(판정 누락 보완).
   */
  z.object({
    type: z.literal('FACT'),
    fact: z.string(),
    keywords: z.array(z.array(z.string().min(1)).min(1)).min(1),
    hint: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
]);
export type MapUnlock = z.infer<typeof mapUnlockSchema>;

export const caseMapSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(20),
  grid: z.array(z.string().min(3).max(40)).min(3).max(30),
  /** 출입구: 이 칸에 들어서면 to 맵의 (toX, toY)로 이동한다 */
  exits: z.array(
    pointSchema.extend({
      to: z.string(),
      toX: z.number().int().min(0),
      toY: z.number().int().min(0),
    }),
  ),
  unlock: mapUnlockSchema,
});
export type CaseMap = z.infer<typeof caseMapSchema>;

export const clueKindSchema = z.enum(['ITEM', 'RECORD', 'TESTIMONY']);
export type ClueKind = z.infer<typeof clueKindSchema>;

export const clueSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  kind: clueKindSchema,
  title: z.string().min(1).max(30),
  content: z.string().min(1).max(200),
  /** 미끼 단서(엔딩에서만 공개, D61) */
  decoy: z.boolean(),
});
export type Clue = z.infer<typeof clueSchema>;

export const caseObjectSchema = pointSchema.extend({
  key: z.string().regex(/^[a-z0-9-]+$/),
  map: z.string(),
  name: z.string().min(1).max(20),
  description: z.string().min(1).max(200),
  clue: z.string().optional(),
});

/** 고정 대사 NPC(PRD D28): 사건당 0~2명, 대사 1~3줄, 처음 대화하면 진술 단서(D75) */
export const caseNpcSchema = pointSchema.extend({
  key: z.string().regex(/^[a-z0-9-]+$/),
  map: z.string(),
  name: z.string().min(1).max(20),
  lines: z.array(z.string().min(1).max(120)).min(1).max(3),
  clue: z.string(),
});

export const exploreContentSchema = z.object({
  maps: z.array(caseMapSchema).min(1),
  /** 첫 맵의 시작 위치 */
  spawn: pointSchema,
  objects: z.array(caseObjectSchema),
  npcs: z.array(caseNpcSchema).max(2),
  clues: z.array(clueSchema),
});
export type ExploreContent = z.infer<typeof exploreContentSchema>;

export function tileAt(map: CaseMap, p: Point): string | undefined {
  return map.grid[p.y]?.[p.x];
}

/** 사람이 서 있을 수 있는 칸: 바닥이고 조사 대상·NPC가 없는 칸 */
export function isWalkable(e: ExploreContent, mapKey: string, p: Point): boolean {
  const map = e.maps.find((m) => m.key === mapKey);
  if (!map || tileAt(map, p) !== MAP_FLOOR) return false;
  const occupied = [...e.objects, ...e.npcs].some(
    (o) => o.map === mapKey && o.x === p.x && o.y === p.y,
  );
  return !occupied;
}

export function isAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/**
 * 현장 조사 데이터 검사(SPEC §11 적재 전 검사): 격자·좌표 일치, 단서 연결, 해금 조건 참조, 도달 가능성.
 * 해금이 순환하지 않는지도 본다(단서 해금 맵의 단서는 그 맵 없이 얻을 수 있어야 함).
 */
export function exploreIssues(e: ExploreContent, ctx: { factIds: string[] }): string[] {
  const issues: string[] = [];
  const mapKeys = e.maps.map((m) => m.key);
  const clueKeys = e.clues.map((c) => c.key);
  const dup = (vs: string[]) => [...new Set(vs.filter((v, i) => vs.indexOf(v) !== i))];
  for (const [label, vs] of [
    ['map key', mapKeys],
    ['clue key', clueKeys],
    ['object/npc key', [...e.objects, ...e.npcs].map((o) => o.key)],
  ] as const) {
    const d = dup([...vs]);
    if (d.length) issues.push(`duplicate ${label}: ${d.join(', ')}`);
  }

  for (const m of e.maps) {
    const width = m.grid[0]!.length;
    if (m.grid.some((row) => row.length !== width))
      issues.push(`map ${m.key}: rows must be same width`);
    if (m.grid.some((row) => /[^#.]/.test(row)))
      issues.push(`map ${m.key}: only '#' and '.' allowed`);
    for (const x of m.exits) {
      const target = e.maps.find((t) => t.key === x.to);
      if (tileAt(m, x) !== MAP_FLOOR)
        issues.push(`map ${m.key}: exit (${x.x},${x.y}) must be floor`);
      if (!target) issues.push(`map ${m.key}: exit to unknown map ${x.to}`);
      else if (!isWalkable(e, target.key, { x: x.toX, y: x.toY }))
        issues.push(
          `map ${m.key}: exit destination (${x.toX},${x.toY}) in ${x.to} is not walkable`,
        );
    }
    if (m.unlock.type === 'CLUE' && !clueKeys.includes(m.unlock.clue))
      issues.push(`map ${m.key}: unlock clue ${m.unlock.clue} not found`);
    if (m.unlock.type === 'FACT' && !ctx.factIds.includes(m.unlock.fact))
      issues.push(`map ${m.key}: unlock fact ${m.unlock.fact} not found`);
  }
  if (e.maps[0]!.unlock.type !== 'OPEN') issues.push('first map must be OPEN');
  if (!isWalkable(e, e.maps[0]!.key, e.spawn))
    issues.push('spawn must be walkable on the first map');

  for (const o of [...e.objects, ...e.npcs]) {
    const map = e.maps.find((m) => m.key === o.map);
    if (!map) issues.push(`${o.key}: unknown map ${o.map}`);
    else if (tileAt(map, o) !== MAP_FLOOR) issues.push(`${o.key}: must stand on a floor tile`);
    if (map?.exits.some((x) => x.x === o.x && x.y === o.y))
      issues.push(`${o.key}: cannot stand on an exit`);
  }
  for (const c of e.clues) {
    const sources = [
      ...e.objects.filter((o) => o.clue === c.key),
      ...e.npcs.filter((n) => n.clue === c.key),
    ];
    if (sources.length !== 1)
      issues.push(`clue ${c.key}: must be linked to exactly one object or npc`);
  }
  for (const o of [...e.objects, ...e.npcs]) {
    if ('clue' in o && o.clue && !clueKeys.includes(o.clue))
      issues.push(`${o.key}: clue ${o.clue} not found`);
  }
  for (const n of e.npcs) {
    if (e.clues.find((c) => c.key === n.clue)?.kind !== 'TESTIMONY')
      issues.push(`npc ${n.key}: clue must be a TESTIMONY`);
  }
  if (issues.length) return issues;

  // 도달 가능성: 열린 맵에서 걸어 다니며 조사로 단서를 얻고, 단서로 맵을 연다. 사실 해금 맵은 힌트로 열 수 있으므로 열린 것으로 본다.
  const opened = new Set(e.maps.filter((m) => m.unlock.type !== 'CLUE').map((m) => m.key));
  const reachedTiles = new Map<string, Set<string>>();
  const found = new Set<string>();
  const entries: { map: string; p: Point }[] = [{ map: e.maps[0]!.key, p: e.spawn }];
  let changed = true;
  while (changed) {
    changed = false;
    while (entries.length) {
      const { map: mk, p } = entries.pop()!;
      if (!opened.has(mk)) continue;
      const seen = reachedTiles.get(mk) ?? new Set<string>();
      reachedTiles.set(mk, seen);
      const queue = [p];
      while (queue.length) {
        const cur = queue.pop()!;
        const id = `${cur.x},${cur.y}`;
        if (seen.has(id) || !isWalkable(e, mk, cur)) continue;
        seen.add(id);
        changed = true;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const)
          queue.push({ x: cur.x + dx, y: cur.y + dy });
        const map = e.maps.find((m) => m.key === mk)!;
        for (const x of map.exits.filter((x) => x.x === cur.x && x.y === cur.y))
          entries.push({ map: x.to, p: { x: x.toX, y: x.toY } });
      }
    }
    for (const o of [...e.objects, ...e.npcs]) {
      const seen = reachedTiles.get(o.map);
      const reachable = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => seen?.has(`${o.x + dx!},${o.y + dy!}`));
      if (reachable && o.clue && !found.has(o.clue)) {
        found.add(o.clue);
        for (const m of e.maps) {
          if (m.unlock.type === 'CLUE' && m.unlock.clue === o.clue && !opened.has(m.key)) {
            opened.add(m.key);
            changed = true;
            // 이미 도달한 출입구로 다시 들어갈 수 있게 모든 진입점을 다시 넣는다.
            for (const src of e.maps)
              for (const x of src.exits.filter((x) => x.to === m.key))
                if (reachedTiles.get(src.key)?.has(`${x.x},${x.y}`))
                  entries.push({ map: m.key, p: { x: x.toX, y: x.toY } });
          }
        }
      }
    }
  }
  for (const m of e.maps)
    if (!reachedTiles.get(m.key)?.size) issues.push(`map ${m.key}: unreachable`);
  for (const o of [...e.objects, ...e.npcs]) {
    const seen = reachedTiles.get(o.map);
    if (
      ![
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => seen?.has(`${o.x + dx!},${o.y + dy!}`))
    )
      issues.push(`${o.key}: no walkable tile next to it is reachable`);
  }
  return issues;
}

// ---- API (SPEC §5: /sessions/{id}/explore · move · inspect) ----

export const positionSchema = z.object({
  map: z.string(),
  x: z.number().int(),
  y: z.number().int(),
});
export type Position = z.infer<typeof positionSchema>;

export const foundClueSchema = z.object({
  key: z.string(),
  kind: clueKindSchema,
  title: z.string(),
  content: z.string(),
});
export type FoundClue = z.infer<typeof foundClueSchema>;

/**
 * 맵 하나의 공개 정보. 닫힌 맵은 이름만 준다. 열린 맵은 격자·출입구·대상 위치와 이름만 주고
 * 설명·단서·미끼 여부는 조사했을 때만 준다(SPEC §13).
 */
export const exploreMapSchema = z.object({
  key: z.string(),
  name: z.string(),
  unlocked: z.boolean(),
  grid: z.array(z.string()).nullable(),
  exits: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
      to: z.string(),
      toX: z.number().int(),
      toY: z.number().int(),
      toName: z.string(),
      locked: z.boolean(),
    }),
  ),
  objects: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      x: z.number().int(),
      y: z.number().int(),
      inspected: z.boolean(),
    }),
  ),
  npcs: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      x: z.number().int(),
      y: z.number().int(),
      talked: z.boolean(),
    }),
  ),
});
export type ExploreMap = z.infer<typeof exploreMapSchema>;

/** GET /sessions/{id}/explore: 화면 복원용(D53). 단서는 얻은 것만. */
export const exploreStateSchema = z.object({
  position: positionSchema,
  maps: z.array(exploreMapSchema),
  clues: z.array(foundClueSchema),
});
export type ExploreState = z.infer<typeof exploreStateSchema>;

/** POST /sessions/{id}/move: 같은 맵 안 이동은 위치 저장, 다른 맵 좌표면 출입구를 통한 이동 */
export const moveRequestSchema = positionSchema;
export type MoveRequest = z.infer<typeof moveRequestSchema>;
export const moveResponseSchema = z.object({ position: positionSchema });
export type MoveResponse = z.infer<typeof moveResponseSchema>;

/** POST /sessions/{id}/inspect: 현재 위치(x, y)와 함께 보내고, 서버가 위치·인접을 검증한다. */
export const inspectRequestSchema = positionSchema.extend({ target: z.string() });
export type InspectRequest = z.infer<typeof inspectRequestSchema>;
export const inspectResponseSchema = z.object({
  kind: z.enum(['OBJECT', 'NPC']),
  name: z.string(),
  description: z.string().nullable(),
  lines: z.array(z.string()).nullable(),
  clue: foundClueSchema.nullable(),
  /** 처음 얻은 단서인지(다시 조사하면 false, '이미 조사함') */
  newClue: z.boolean(),
  /** 이번에 새로 열린 맵 이름 */
  unlockedMaps: z.array(z.string()),
});
export type InspectResponse = z.infer<typeof inspectResponseSchema>;
