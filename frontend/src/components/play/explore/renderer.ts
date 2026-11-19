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
/**
 * 탐정 걷기 그림(가로 3프레임 × 세로 4방향). 캐릭터 그림은 칸의 2배(64px)로 받아 32px 칸에 맞춰 그린다(D102).
 * 기본은 자체 제작(frontend/scripts/make-detective-sprite.mjs), AI 생성 그림으로 같은 파일을 바꿔 끼운다.
 */
const SPRITE_PX = 64;
const SHEET = { key: 'detective', url: '/sprites/detective.png' };
/** NPC 그림(앞모습 한 장, 64×64): frontend/public/sprites/npc/<이름>.png */
const npcSpriteUrl = (name: string) => `/sprites/npc/${name}.png`;
const ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
/** 가운데 열이 서 있는 모습, 양옆이 걸음 */
const STAND = 1;
const STEP_MS = 110;
/**
 * 화면 크기는 맵과 상관없이 16:9로 고정한다(가장 큰 맵 16×9칸). 맵을 옮길 때 화면이 커졌다 작아지지 않게,
 * 작은 맵은 이 안에 맞춰 확대하고 가운데 둔다(남는 곳은 여백).
 */
const VIEW = { width: TILE * 16, height: TILE * 9 };

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

  /** NPC 그림을 불러와 그린다. 이미 대화한 NPC는 조금 어둡게. 그 사이 다른 맵으로 옮겼으면 버린다. */
  function drawNpcSprite(
    s: Scene,
    name: string,
    x: number,
    y: number,
    talked: boolean,
    mark: string,
  ) {
    const key = `npc:${name}`;
    const place = () => {
      if (drawnMap !== mark || !s.textures.exists(key)) return;
      const img = s.add.image(center(x), center(y), key).setDisplaySize(TILE, TILE).setDepth(5);
      if (talked) img.setTint(0xb0b0b0);
    };
    if (s.textures.exists(key)) return place();
    s.load.image(key, npcSpriteUrl(name));
    s.load.once('complete', place);
    // 그림이 없거나 못 불러오면 색 입힌 탐정 그림으로 대신 그린다
    s.load.once('loaderror', () => {
      if (drawnMap === mark) drawTintedNpc(s, x, y, talked);
    });
    s.load.start();
  }

  function drawTintedNpc(s: Scene, x: number, y: number, talked: boolean) {
    s.add
      .sprite(center(x), center(y), SHEET.key, ROW.down * 3 + STAND)
      .setDisplaySize(TILE, TILE)
      .setTint(talked ? COLORS.npcTalkedTint : COLORS.npcTint)
      .setDepth(5);
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
      // 고정 크기 화면 안에 맵 전체가 보이게 확대하고 가운데 둔다
      const cam = s.cameras.main;
      cam.setZoom(Math.min(VIEW.width / width, VIEW.height / height));
      cam.centerOn(width / 2, height / 2);
      if (map.background) drawBackground(s, map, width, height, mark);
      else drawShapes(s, map);

      for (const e of map.exits) {
        if (map.background) {
          // 그림 속 문이 출입구다. 아직 못 가는 곳만 작은 자물쇠를 둔다
          if (e.locked)
            s.add
              .text(center(e.x), center(e.y), '🔒', { fontSize: '12px' })
              .setOrigin(0.5)
              .setAlpha(0.85);
          continue;
        }
        s.add.rectangle(
          center(e.x),
          center(e.y),
          TILE - 4,
          TILE - 4,
          e.locked ? COLORS.exitLocked : COLORS.exit,
        );
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
        if (n.sprite) {
          drawNpcSprite(s, n.sprite, n.x, n.y, n.talked, mark);
          continue;
        }
        // NPC 그림이 없으면 탐정 그림에 색을 입혀 구분한다
        drawTintedNpc(s, n.x, n.y, n.talked);
      }
      player = s.add
        .sprite(0, 0, SHEET.key, ROW[facing] * 3 + STAND)
        .setDisplaySize(TILE, TILE)
        .setDepth(10);
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
      this.load.spritesheet(SHEET.key, SHEET.url, {
        frameWidth: SPRITE_PX,
        frameHeight: SPRITE_PX,
      });
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
    width: VIEW.width,
    height: VIEW.height,
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
