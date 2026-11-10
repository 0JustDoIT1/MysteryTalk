import { describe, expect, it } from 'vitest';
import type { ExploreMap } from '@mysterytalk/shared';
import { canStand, dirForKey, exitAt, targetNear } from './explore';

const map: ExploreMap = {
  key: 'room',
  name: '방',
  unlocked: true,
  grid: ['#####', '#...#', '#...#', '##.##'],
  exits: [{ x: 2, y: 3, to: 'hall', toX: 1, toY: 1, toName: '복도', locked: true }],
  objects: [{ key: 'desk', name: '책상', x: 1, y: 1, inspected: false }],
  npcs: [{ key: 'kim', name: '관리인', x: 3, y: 2, talked: false }],
};

describe('현장 조사 이동 판단', () => {
  it('벽·대상 칸에는 설 수 없고 바닥·출입구에는 설 수 있다', () => {
    expect(canStand(map, { x: 0, y: 0 })).toBe(false);
    expect(canStand(map, { x: 1, y: 1 })).toBe(false);
    expect(canStand(map, { x: 2, y: 2 })).toBe(true);
    expect(canStand(map, { x: 2, y: 3 })).toBe(true);
    expect(exitAt(map, { x: 2, y: 3 })?.to).toBe('hall');
  });

  it('방향키와 WASD를 같은 방향으로 본다', () => {
    expect(dirForKey('ArrowUp')).toBe('up');
    expect(dirForKey('a')).toBe('left');
    expect(dirForKey('x')).toBeNull();
  });

  it('바라보는 방향의 대상을 먼저, 없으면 붙어 있는 대상을 고른다', () => {
    const at = { map: 'room', x: 2, y: 1 };
    expect(targetNear(map, at, 'left')?.key).toBe('desk');
    expect(targetNear(map, { map: 'room', x: 2, y: 2 }, 'right')?.key).toBe('kim');
    expect(targetNear(map, { map: 'room', x: 2, y: 2 }, 'up')?.key).toBe('kim');
    expect(targetNear(map, { map: 'room', x: 2, y: 3 }, 'up')).toBeNull();
  });
});
