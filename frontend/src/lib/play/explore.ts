import type { ExploreMap, Position } from '@mysterytalk/shared';

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** 키 → 방향(SPEC §9.3: 방향키/WASD) */
export function dirForKey(key: string): Dir | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

export function isInteractKey(key: string): boolean {
  return key === 'e' || key === 'E' || key === 'Enter' || key === ' ';
}

/** 설 수 있는 칸: 바닥이고 조사 대상·NPC가 없는 칸(서버 isWalkable 과 같은 규칙) */
export function canStand(map: ExploreMap, p: { x: number; y: number }): boolean {
  if (map.grid?.[p.y]?.[p.x] !== '.') return false;
  return ![...map.objects, ...map.npcs].some((o) => o.x === p.x && o.y === p.y);
}

export type Target = { key: string; name: string; kind: 'OBJECT' | 'NPC' };

/** 조사할 대상: 바라보는 방향의 칸을 먼저, 없으면 붙어 있는 아무 대상(인접 = 맨해튼 거리 1) */
export function targetNear(map: ExploreMap, p: Position, facing: Dir): Target | null {
  const all: (Target & { x: number; y: number })[] = [
    ...map.objects.map((o) => ({ ...o, kind: 'OBJECT' as const })),
    ...map.npcs.map((n) => ({ ...n, kind: 'NPC' as const })),
  ];
  const ahead = { x: p.x + DELTA[facing].dx, y: p.y + DELTA[facing].dy };
  const found =
    all.find((o) => o.x === ahead.x && o.y === ahead.y) ??
    all.find((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) === 1);
  return found ? { key: found.key, name: found.name, kind: found.kind } : null;
}

export function exitAt(map: ExploreMap, p: { x: number; y: number }) {
  return map.exits.find((x) => x.x === p.x && x.y === p.y) ?? null;
}
