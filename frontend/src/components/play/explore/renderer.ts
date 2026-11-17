import { MAP_TILE_PX, type ExploreMap, type Position } from '@mysterytalk/shared';
import type { Dir } from '@/lib/play/explore';

type PhaserModule = typeof import('phaser');
type Scene = InstanceType<PhaserModule['Scene']>;
type Sprite = InstanceType<PhaserModule['GameObjects']['Sprite']>;

/**
 * 현장 조사 화면(PRD D94). 맵에 배경 그림이 있으면 그림을 깔고 벽·바닥 도형을 숨긴다.
 * 배경이 없는 맵은 임시 도형으로 그린다. 캐릭터는 쯔꾸르식 스프라이트 시트(가로 3프레임 × 세로 4방향).
 */
export const TILE = MAP_TILE_PX;
const COLORS = {
  wall: 0x292524,
  floor: 0x57534e,
  floorAlt: 0x524e49,
  exit: 0x78716c,
  exitLocked: 0x7f1d1d,
  object: 0xd97706,
  objectDone: 0x92400e,
  npcTint: 0x7dd3c0,
  npcTalkedTint: 0x4b8f84,
};
/** 자체 제작 탐정 캐릭터(frontend/scripts/make-detective-sprite.mjs) */
const SHEET = { key: 'detective', url: '/sprites/detective.png' };
const ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
/** 가운데 열이 서 있는 모습, 양옆이 걸음 */
const STAND = 1;
const STEP_MS = 110;

export type ExploreRenderer = {
  draw: (map: ExploreMap, pos: Position, facing: Dir) => void;
  destroy: () => void;
};

/**
 * Phaser 화면: 맵·대상·플레이어를 그리기만 한다. 이동 판단·API 호출은 React가 한다(SPEC §9.3).
 * Phaser는 브라우저에서만 불러온다(dynamic import). 배경 그림은 세션 인증이 필요해 주소를 받아 쓴다.
 */
export async function createRenderer(
  parent: HTMLElement,
  opts: { backgroundUrl: (mapKey: string) => string },
): Promise<ExploreRenderer> {
  const Phaser: PhaserModule = await import('phaser');
  let pending: { map: ExploreMap; pos: Position; facing: Dir } | null = null;
  let scene: Scene | null = null;
  let drawnMap: string | null = null;
  let player: Sprite | null = null;
  let last: { x: number; y: number; map: string } | null = null;
  let stepToggle = false;
  let standTimer: ReturnType<typeof setTimeout> | null = null;

  const center = (v: number) => v * TILE + TILE / 2;

  function drawShapes(s: Scene, map: ExploreMap) {
    (map.grid ?? []).forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const color = ch === '#' ? COLORS.wall : (x + y) % 2 ? COLORS.floor : COLORS.floorAlt;
        s.add.rectangle(center(x), center(y), TILE, TILE, color);
      }),
    );
  }

  /** 배경 그림을 불러와 맨 아래에 깐다. 그 사이 다른 맵으로 옮겼으면 버린다. */
  function drawBackground(s: Scene, map: ExploreMap, width: number, height: number, mark: string) {
    const key = `bg:${map.key}`;
    const place = () => {
      if (drawnMap !== mark || !s.textures.exists(key)) return;
      s.add.image(0, 0, key).setOrigin(0).setDisplaySize(width, height).setDepth(-10);
    };
    if (s.textures.exists(key)) return place();
    s.load.image(key, opts.backgroundUrl(map.key));
    s.load.once('complete', place);
    // 불러오지 못하면 도형으로 대신 그린다
    s.load.once('loaderror', () => {
      if (drawnMap === mark) drawShapes(s, map);
    });
    s.load.start();
  }

  function render(map: ExploreMap, pos: Position, facing: Dir) {
    if (!scene) {
      pending = { map, pos, facing };
      return;
    }
    const s = scene;
    const grid = map.grid ?? [];
    const width = (grid[0]?.length ?? 1) * TILE;
    const height = grid.length * TILE;
    const mark = `${map.key}:${map.background}:${JSON.stringify([map.objects, map.npcs, map.exits])}`;
    if (drawnMap !== mark) {
      drawnMap = mark;
      s.children.removeAll(true);
      s.scale.resize(width, height);
      if (map.background) drawBackground(s, map, width, height, mark);
      else drawShapes(s, map);

      for (const e of map.exits) {
        // 그림이 있어도 출입구는 작게 표시한다(열림·잠김 구분)
        s.add
          .rectangle(
            center(e.x),
            center(e.y),
            TILE - 4,
            TILE - 4,
            e.locked ? COLORS.exitLocked : COLORS.exit,
          )
          .setAlpha(map.background ? 0.45 : 1);
        s.add
          .text(center(e.x), center(e.y), e.locked ? '🔒' : '🚪', { fontSize: '16px' })
          .setOrigin(0.5);
      }
      for (const o of map.objects) {
        if (map.background) {
          // 그림 속 물건이 조사 대상이다. 아직 조사하지 않은 곳만 작은 표시를 둔다
          if (!o.inspected) s.add.circle(center(o.x), center(o.y), 4, COLORS.object).setAlpha(0.7);
          continue;
        }
        s.add.rectangle(
          center(o.x),
          center(o.y),
          TILE - 6,
          TILE - 6,
          o.inspected ? COLORS.objectDone : COLORS.object,
        );
        s.add
          .text(center(o.x), center(o.y), o.name.slice(0, 1), {
            fontSize: '14px',
            color: '#1c1917',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
      }
      for (const n of map.npcs) {
        s.add
          .sprite(center(n.x), center(n.y), SHEET.key, ROW.down * 3 + STAND)
          .setTint(n.talked ? COLORS.npcTalkedTint : COLORS.npcTint)
          .setDepth(5);
      }
      player = s.add.sprite(0, 0, SHEET.key, ROW[facing] * 3 + STAND).setDepth(10);
      last = null;
    }
    if (player) {
      const moved = last && last.map === map.key && (last.x !== pos.x || last.y !== pos.y);
      player.setPosition(center(pos.x), center(pos.y));
      const row = ROW[facing] * 3;
      if (moved) {
        // 한 칸 움직일 때마다 왼발·오른발을 번갈아 보여 주고 잠시 뒤 선 자세로
        stepToggle = !stepToggle;
        player.setFrame(row + (stepToggle ? 0 : 2));
        if (standTimer) clearTimeout(standTimer);
        const p = player;
        standTimer = setTimeout(() => p.active && p.setFrame(row + STAND), STEP_MS);
      } else {
        player.setFrame(row + STAND);
      }
      last = { x: pos.x, y: pos.y, map: map.key };
    }
  }

  function onCreate(created: Scene) {
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
    preload() {
      this.load.spritesheet(SHEET.key, SHEET.url, { frameWidth: TILE, frameHeight: TILE });
    }
    create() {
      onCreate(this);
    }
  }

  // 이전 렌더러의 캔버스가 남아 있으면 치운다(개발 모드에서 화면이 두 번 붙을 때 이전 화면의 정리가
  // 다음 프레임으로 미뤄져 캔버스가 겹칠 수 있다).
  parent.querySelectorAll('canvas').forEach((c) => c.remove());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: TILE * 10,
    height: TILE * 6,
    backgroundColor: '#1c1917',
    pixelArt: true,
    // 키 입력은 React가 받는다(질문 입력과 충돌하지 않게). Phaser 키보드·마우스 입력은 끈다.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scene: ExploreScene,
    banner: false,
    audio: { noAudio: true },
  });

  return {
    draw: render,
    destroy: () => {
      if (standTimer) clearTimeout(standTimer);
      game.destroy(true);
    },
  };
}
