import type { ExploreMap, Position } from '@mysterytalk/shared';
import type { Dir } from '@/lib/play/explore';

type PhaserModule = typeof import('phaser');

/** 임시 도형 그림(4단계 결정). 에셋이 정해지면 이 파일만 타일·스프라이트로 바꾼다(PRD D67). */
export const TILE = 32;
const COLORS = {
  wall: 0x292524,
  floor: 0x57534e,
  floorAlt: 0x524e49,
  exit: 0x78716c,
  exitLocked: 0x7f1d1d,
  object: 0xd97706,
  objectDone: 0x92400e,
  npc: 0x0d9488,
  npcDone: 0x115e59,
  player: 0xfde047,
};

export type ExploreRenderer = {
  draw: (map: ExploreMap, pos: Position, facing: Dir) => void;
  destroy: () => void;
};

/**
 * Phaser 화면: 맵·대상·플레이어를 그리기만 한다. 이동 판단·API 호출은 React가 한다(SPEC §9.3).
 * Phaser는 브라우저에서만 불러온다(dynamic import).
 */
export async function createRenderer(parent: HTMLElement): Promise<ExploreRenderer> {
  const Phaser: PhaserModule = await import('phaser');
  let pending: { map: ExploreMap; pos: Position; facing: Dir } | null = null;
  let scene: InstanceType<PhaserModule['Scene']> | null = null;
  let drawnMap: string | null = null;
  let player: InstanceType<PhaserModule['GameObjects']['Container']> | null = null;

  function render(map: ExploreMap, pos: Position, facing: Dir) {
    if (!scene) {
      pending = { map, pos, facing };
      return;
    }
    const grid = map.grid ?? [];
    const width = (grid[0]?.length ?? 1) * TILE;
    const height = grid.length * TILE;
    if (drawnMap !== `${map.key}:${JSON.stringify([map.objects, map.npcs, map.exits])}`) {
      drawnMap = `${map.key}:${JSON.stringify([map.objects, map.npcs, map.exits])}`;
      scene.children.removeAll(true);
      scene.scale.resize(width, height);
      grid.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const color = ch === '#' ? COLORS.wall : (x + y) % 2 ? COLORS.floor : COLORS.floorAlt;
          scene!.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, color);
        }),
      );
      for (const e of map.exits) {
        scene.add.rectangle(
          e.x * TILE + TILE / 2,
          e.y * TILE + TILE / 2,
          TILE - 4,
          TILE - 4,
          e.locked ? COLORS.exitLocked : COLORS.exit,
        );
        scene.add
          .text(e.x * TILE + TILE / 2, e.y * TILE + TILE / 2, e.locked ? '🔒' : '🚪', {
            fontSize: '16px',
          })
          .setOrigin(0.5);
      }
      for (const o of map.objects) {
        scene.add.rectangle(
          o.x * TILE + TILE / 2,
          o.y * TILE + TILE / 2,
          TILE - 6,
          TILE - 6,
          o.inspected ? COLORS.objectDone : COLORS.object,
        );
        scene.add
          .text(o.x * TILE + TILE / 2, o.y * TILE + TILE / 2, o.name.slice(0, 1), {
            fontSize: '14px',
            color: '#1c1917',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
      }
      for (const n of map.npcs) {
        scene.add.circle(
          n.x * TILE + TILE / 2,
          n.y * TILE + TILE / 2,
          TILE / 2 - 3,
          n.talked ? COLORS.npcDone : COLORS.npc,
        );
        scene.add
          .text(
            n.x * TILE + TILE / 2,
            n.y * TILE + TILE / 2,
            (n.name.split(' ').pop() ?? n.name)[0]!,
            {
              fontSize: '13px',
              color: '#f0fdfa',
              fontStyle: 'bold',
            },
          )
          .setOrigin(0.5);
      }
      const body = scene.add.circle(0, 0, TILE / 2 - 4, COLORS.player);
      const eye = scene.add.circle(0, 0, 3, 0x1c1917);
      player = scene.add.container(0, 0, [body, eye]);
      player.setDepth(10);
    }
    if (player) {
      player.setPosition(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2);
      const eye = player.list[1] as InstanceType<PhaserModule['GameObjects']['Arc']>;
      const d = { up: [0, -6], down: [0, 6], left: [-6, 0], right: [6, 0] }[facing];
      eye.setPosition(d[0]!, d[1]!);
    }
  }

  function onCreate(created: InstanceType<PhaserModule['Scene']>) {
    scene = created;
    created.cameras.main.setBackgroundColor('#1c1917');
    if (pending) {
      const p = pending;
      pending = null;
      render(p.map, p.pos, p.facing);
    }
  }

  class ExploreScene extends Phaser.Scene {
    constructor() {
      super('explore');
    }
    create() {
      onCreate(this);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: TILE * 10,
    height: TILE * 6,
    backgroundColor: '#1c1917',
    // 키 입력은 React가 받는다(질문 입력과 충돌하지 않게). Phaser 키보드·마우스 입력은 끈다.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scene: ExploreScene,
    banner: false,
    audio: { noAudio: true },
  });

  return {
    draw: render,
    destroy: () => game.destroy(true),
  };
}
