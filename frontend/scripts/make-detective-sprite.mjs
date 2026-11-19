// 자체 제작 탐정 캐릭터 도트(PRD D94, 라이선스 문제 없는 자리표시 겸 기본 캐릭터).
// 16×16 도안을 4배로 키워 64×64 프레임을 만들고, 쯔꾸르식 배치(가로 3프레임: 걸음1·서기·걸음2,
// 세로 4방향: 아래·왼쪽·오른쪽·위)로 192×256 PNG를 쓴다. 의존성 없이 zlib만 쓴다.
// 실행: node frontend/scripts/make-detective-sprite.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BASE = {
  K: [43, 33, 24], // 모자·머리카락
  H: [139, 30, 30], // 모자 띠
  S: [241, 194, 125], // 피부
  E: [27, 27, 27], // 눈
  C: [138, 106, 60], // 트렌치코트
  c: [109, 82, 45], // 코트 그림자·여밈
  B: [61, 43, 26], // 허리띠
  P: [47, 53, 66], // 바지
  O: [17, 17, 17], // 신발
};

const top = {
  down: [
    '................',
    '.....KKKKKK.....',
    '....KKKKKKKK....',
    '...KKHHHHHHKK...',
    '.....SSSSSS.....',
    '.....SESSES.....',
    '.....SSSSSS.....',
    '....CCCSSCCC....',
    '...CCCCcCCCCC...',
    '..SCCCCcCCCCCS..',
    '...CCCCcCCCCC...',
    '...CCBBBBBBCC...',
    '....CCCcCCCC....',
  ],
  up: [
    '................',
    '.....KKKKKK.....',
    '....KKKKKKKK....',
    '...KKHHHHHHKK...',
    '.....KKKKKK.....',
    '.....KKKKKK.....',
    '.....SSSSSS.....',
    '....CCCCCCCC....',
    '...CCCCCCCCCC...',
    '..SCCCCCCCCCCS..',
    '...CCCCcCCCCC...',
    '...CCBBBBBBCC...',
    '....CCCcCCCC....',
  ],
  left: [
    '................',
    '.....KKKKKK.....',
    '....KKKKKKKK....',
    '..KKKHHHHHKK....',
    '.....SSSSSK.....',
    '.....ESSSSK.....',
    '.....SSSSS......',
    '......CCCC......',
    '.....CCCCCC.....',
    '.....CCSCCC.....',
    '.....CCCCCC.....',
    '.....BBBBBB.....',
    '.....CCCCCC.....',
  ],
};
const legs = {
  front: {
    stand: ['.....PP..PP.....', '.....PP..PP.....', '.....OO..OO.....'],
    stepA: ['.....PP..PP.....', '.....OO..PP.....', '..........OO....'],
    stepB: ['.....PP..PP.....', '.....PP..OO.....', '.....OO.........'],
  },
  side: {
    stand: ['......PPP.......', '......PPP.......', '......OOO.......'],
    stepA: ['.....PP.PP......', '....PP...PP.....', '....OO...OO.....'],
    stepB: ['......PPPP......', '......PP.P......', '......OO.O......'],
  },
};

const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));
function frame(dir, step) {
  if (dir === 'right') return mirror(frame('left', step));
  const body = top[dir];
  const leg = (dir === 'left' ? legs.side : legs.front)[step];
  return [...body, ...leg];
}

const DIRS = ['down', 'left', 'right', 'up'];
const STEPS = ['stepA', 'stand', 'stepB'];
const SCALE = 4; // 64×64 프레임(캐릭터 그림 규격, PRD D102)
const FW = 16 * SCALE;
const W = FW * 3;
const H = FW * 4;
function build(PALETTE) {
  const rgba = Buffer.alloc(W * H * 4);
  DIRS.forEach((dir, row) =>
    STEPS.forEach((step, col) => {
      const f = frame(dir, step);
      if (f.length !== 16 || f.some((r) => r.length !== 16)) throw new Error(`${dir}/${step} size`);
      f.forEach((line, y) =>
        [...line].forEach((ch, x) => {
          const color = PALETTE[ch];
          if (!color) return;
          for (let dy = 0; dy < SCALE; dy++)
            for (let dx = 0; dx < SCALE; dx++) {
              const px = col * FW + x * SCALE + dx;
              const py = row * FW + y * SCALE + dy;
              const i = (py * W + px) * 4;
              rgba.set([...color, 255], i);
            }
        }),
      );
    }),
  );

  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.concat(
    Array.from({ length: H }, (_, y) =>
      Buffer.concat([Buffer.from([0]), rgba.subarray(y * W * 4, (y + 1) * W * 4)]),
    ),
  );
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

// 탐정 캐릭터 2종(sprites/detectives/noir.png·inspector.png)은 AI 생성 그림으로 바꿨다(PRD D102·D103,
// 출처는 ASSETS.md). 이 스크립트는 자체 제작 기본 도안(detective.png)만 만든다.
mkdirSync(new URL('../public/sprites/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/sprites/detective.png', import.meta.url), build(BASE));
console.log('detective.png', `${W}x${H}`);
