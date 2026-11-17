import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  caseContentSchema,
  clueChain,
  exploreIssues,
  hintSchema,
  IMAGE_MAX_BYTES,
  imageSize,
  personNamingIssues,
  visibleCaseFile,
  type ExploreContent,
} from '@mysterytalk/shared';
import { evalSetSchema } from '../eval/eval-set.js';
import { contentHash, readCaseDirs } from './content-files.js';

const publicRoot = resolve(import.meta.dirname, '../../../content/public');

describe('사건 데이터 파일 (SPEC §11)', () => {
  it('공개 사건(튜토리얼·샘플)은 형식 검사를 통과하고 평가 세트도 유효하다(D65: 질문 30개 이상)', () => {
    const cases = readCaseDirs([publicRoot]);
    expect(cases.map((c) => c.content.slug).sort()).toEqual([
      'sample-blackout-302',
      'tutorial-missing-key',
    ]);
    expect(cases.filter((c) => c.content.isTutorial)).toHaveLength(1);
    for (const c of cases) {
      const evalSet = evalSetSchema.parse(
        JSON.parse(readFileSync(join(c.dir, 'eval.json'), 'utf8')),
      );
      expect(evalSet.caseSlug).toBe(c.content.slug);
      expect(evalSet.questions.length).toBeGreaterThanOrEqual(30);
      expect(evalSet.answers.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('형식이 틀린 사건은 파일 경로와 필드를 알려 주며 실패한다', () => {
    const root = mkdtempSync(join(tmpdir(), 'mt-cases-'));
    mkdirSync(join(root, 'bad'));
    writeFileSync(join(root, 'bad', 'case.json'), JSON.stringify({ slug: 'Bad Slug' }));
    expect(() => readCaseDirs([root])).toThrow(
      /bad[\\/]case\.json: invalid case content[\s\S]*slug/,
    );
  });

  it('slug가 겹치면 실패한다', () => {
    const tutorial = readFileSync(join(publicRoot, 'tutorial', 'case.json'), 'utf8');
    const root = mkdtempSync(join(tmpdir(), 'mt-cases-'));
    for (const d of ['a', 'b']) {
      mkdirSync(join(root, d));
      writeFileSync(join(root, d, 'case.json'), tutorial);
    }
    expect(() => readCaseDirs([root])).toThrow(/duplicate case slug: tutorial-missing-key/);
  });

  it('없는 폴더는 건너뛴다(비공개 사건 폴더가 없는 개발 환경)', () => {
    expect(readCaseDirs([join(tmpdir(), 'mt-no-such-dir-xyz')])).toEqual([]);
  });

  describe('인물 표기 규칙(지칭 중심 + 이름 병기)', () => {
    const base = {
      caseFile: {
        people: [
          { name: '문태성', role: '조카' },
          { name: '오만식', role: '관리인' },
        ],
      },
      facts: [{ id: 'F01', text: '조카 문태성이 밀쳤다. 조카 문태성은 달아났다.' }],
      hints: [{ no: 1 as const, text: '관리인 오만식에게 물어보세요.' }],
      elements: [
        {
          id: 'A1',
          description: '범인은 조카 문태성',
          keywordGroups: [['문태성', '태성', '조카']],
        },
      ],
    };

    it('규칙을 지킨 사건은 문제가 없다', () => {
      expect(personNamingIssues(base)).toEqual([]);
    });

    it('사실·힌트·정답 요소에서 이름만 쓰면 지칭을 붙이라고 알려 준다', () => {
      const issues = personNamingIssues({
        ...base,
        facts: [{ id: 'F01', text: '조카 문태성이 밀쳤다. 문태성은 달아났다.' }],
        hints: [{ no: 1, text: '오만식에게 물어보세요.' }],
      });
      expect(issues).toEqual([
        'F01: write "조카 문태성" instead of "문태성"',
        'hint 1: write "관리인 오만식" instead of "오만식"',
      ]);
    });

    it('지칭이 겹치면 실패한다(괄호 앞부분 기준)', () => {
      const issues = personNamingIssues({
        ...base,
        caseFile: {
          people: [
            { name: '문태성', role: '조카' },
            { name: '문태희', role: '조카(동생)' },
          ],
        },
      });
      expect(issues).toContain('duplicate person designation: 조카');
    });

    it('정답 키워드에 성명이 있으면 이름만·지칭도 있어야 한다', () => {
      const issues = personNamingIssues({
        ...base,
        elements: [{ id: 'A1', description: '범인은 조카 문태성', keywordGroups: [['문태성']] }],
      });
      expect(issues).toEqual([
        'A1: keyword group with "문태성" must also include "태성"',
        'A1: keyword group with "문태성" must also include "조카"',
      ]);
    });
  });

  describe('현장 조사 데이터 검사(SPEC §11)', () => {
    const base = (): ExploreContent => ({
      maps: [
        {
          key: 'a',
          name: '방',
          grid: ['#####', '#...#', '#....', '#####'],
          exits: [{ x: 4, y: 2, to: 'b', toX: 1, toY: 1 }],
          unlock: { type: 'OPEN' },
        },
        {
          key: 'b',
          name: '복도',
          grid: ['####', '#..#', '####'],
          exits: [],
          unlock: { type: 'CLUE', clue: 'note' },
        },
      ],
      spawn: { x: 1, y: 1 },
      objects: [
        { key: 'desk', map: 'a', x: 3, y: 1, name: '책상', description: '책상', clue: 'note' },
      ],
      npcs: [],
      clues: [{ key: 'note', kind: 'ITEM', title: '쪽지', content: '쪽지', decoy: false }],
    });

    it('올바른 데이터는 문제가 없다', () => {
      expect(exploreIssues(base(), { factIds: [] })).toEqual([]);
    });

    it('격자 너비·글자, 출입구 도착 칸, 시작 위치를 검사한다', () => {
      const e = base();
      e.maps[0]!.grid[1] = '#..x#';
      e.maps[1]!.grid.push('#');
      e.maps[0]!.exits[0]!.toX = 0;
      e.spawn = { x: 0, y: 0 };
      expect(exploreIssues(e, { factIds: [] })).toEqual(
        expect.arrayContaining([
          "map a: only '#' and '.' allowed",
          'map b: rows must be same width',
          'map a: exit destination (0,1) in b is not walkable',
          'spawn must be walkable on the first map',
        ]),
      );
    });

    it('단서는 대상 하나에만 연결되고, 해금 조건이 가리키는 단서·사실이 있어야 한다', () => {
      const e = base();
      e.objects[0]!.clue = undefined;
      e.maps[1]!.unlock = { type: 'FACT', fact: 'F99', keywords: [['x']], hint: 1 };
      expect(exploreIssues(e, { factIds: ['F01'] })).toEqual(
        expect.arrayContaining([
          'clue note: must be linked to exactly one object, npc or revealing clue',
          'map b: unlock fact F99 not found',
        ]),
      );
    });

    it('해금 단서를 그 맵 안에서만 얻을 수 있으면(순환) 도달할 수 없다고 알려 준다', () => {
      const e = base();
      e.objects[0]! = { ...e.objects[0]!, map: 'b', x: 2, y: 1 };
      expect(exploreIssues(e, { factIds: [] })).toEqual(
        expect.arrayContaining([
          'map b: unreachable',
          'desk: no walkable tile next to it is reachable',
        ]),
      );
    });

    it('단서 연쇄(D91): 연쇄로 얻는 단서로도 맵이 열리고, 여러 단계로 이어진다', () => {
      const e = base();
      e.objects[0]!.clue = 'note';
      e.clues[0]!.reveals = ['memo'];
      e.clues.push(
        {
          key: 'memo',
          kind: 'RECORD',
          title: '메모',
          content: '메모',
          decoy: false,
          reveals: ['photo'],
        },
        { key: 'photo', kind: 'ITEM', title: '사진', content: '사진', decoy: false },
      );
      e.maps[1]!.unlock = { type: 'CLUE', clue: 'photo' };
      expect(exploreIssues(e, { factIds: [] })).toEqual([]);
      expect(clueChain(e, 'note')).toEqual(['note', 'memo', 'photo']);
      expect(clueChain(e, 'memo')).toEqual(['memo', 'photo']);
    });

    it('단서 연쇄: 없는 단서·자기 자신을 가리키거나, 서로만 여는 순환이면 알려 준다', () => {
      const e = base();
      e.clues[0]!.reveals = ['ghost', 'note'];
      e.clues.push(
        { key: 'x', kind: 'ITEM', title: 'x', content: 'x', decoy: false, reveals: ['y'] },
        { key: 'y', kind: 'ITEM', title: 'y', content: 'y', decoy: false, reveals: ['x'] },
      );
      expect(exploreIssues(e, { factIds: [] })).toEqual(
        expect.arrayContaining([
          'clue note: reveals unknown clue ghost',
          'clue note: cannot reveal itself',
        ]),
      );
      e.clues[0]!.reveals = undefined;
      expect(exploreIssues(e, { factIds: [] })).toEqual(
        expect.arrayContaining(['clue x: cannot be obtained', 'clue y: cannot be obtained']),
      );
    });

    it('단서 연쇄: 대상과 연쇄 양쪽에서 얻는 단서는 출처가 둘이라 거부한다', () => {
      const e = base();
      e.clues.push({
        key: 'memo',
        kind: 'RECORD',
        title: '메모',
        content: '메모',
        decoy: false,
        reveals: ['note'],
      });
      expect(exploreIssues(e, { factIds: [] })).toEqual(
        expect.arrayContaining([
          'clue note: must be linked to exactly one object, npc or revealing clue',
        ]),
      );
    });
  });

  describe('수사 자료 점진 공개(D90)', () => {
    const tutorial = () =>
      JSON.parse(readFileSync(join(publicRoot, 'tutorial', 'case.json'), 'utf8')) as {
        caseFile: { people: { revealedBy?: string }[]; timeline: { revealedBy?: string }[] };
        clues: { key: string }[];
      };

    it('처음 공개 항목 + 얻은 단서로 공개된 항목만 보이고, 공개 조건은 내보내지 않는다', () => {
      const cf = {
        overview: [{ label: '장소', value: '빵집' }],
        people: [
          { id: 'P1', name: '갑', role: '사장', publicInfo: '처음부터' },
          { id: 'P2', name: '을', role: '직원', publicInfo: '나중에', revealedBy: 'note' },
        ],
        timeline: [
          { at: '09:00', text: '처음부터' },
          { at: '10:00', text: '나중에', revealedBy: 'memo' },
        ],
      };
      const start = visibleCaseFile(cf, new Set());
      expect(start.people.map((p) => p.id)).toEqual(['P1']);
      expect(start.timeline.map((t) => t.at)).toEqual(['09:00']);
      const later = visibleCaseFile(cf, new Set(['note', 'memo']));
      expect(later.people.map((p) => p.id)).toEqual(['P1', 'P2']);
      expect(later.timeline).toHaveLength(2);
      expect(JSON.stringify(later)).not.toContain('revealedBy');
    });

    it('없는 단서를 공개 조건으로 쓰거나 처음 보이는 관련자가 없으면 실패한다', () => {
      const c = tutorial();
      c.caseFile.timeline[0]!.revealedBy = 'no-such-clue';
      for (const p of c.caseFile.people) p.revealedBy = c.clues[0]!.key;
      const r = caseContentSchema.safeParse(c);
      expect(r.success).toBe(false);
      const messages = r.error!.issues.map((i) => i.message);
      expect(messages).toEqual(
        expect.arrayContaining([
          'case file item revealed by unknown clue no-such-clue',
          'at least one person must be visible from the start',
        ]),
      );
    });
  });
});

describe('사건 이미지(D92·D93)', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  /** 튜토리얼을 복사해 힌트 1을 이미지 힌트로 바꾼 임시 사건 폴더 */
  function imageCase(image: Buffer | null, name = 'hint-1.png') {
    const c = JSON.parse(readFileSync(join(publicRoot, 'tutorial', 'case.json'), 'utf8'));
    c.hints[0] = { no: 1, image: name, alt: '열쇠 걸이 사진' };
    const root = mkdtempSync(join(tmpdir(), 'mt-img-'));
    mkdirSync(join(root, 'tut', 'images'), { recursive: true });
    writeFileSync(join(root, 'tut', 'case.json'), JSON.stringify(c));
    if (image) writeFileSync(join(root, 'tut', 'images', name), image);
    return root;
  }

  it('이미지 힌트를 읽어 형식과 내용을 함께 싣고, 이미지가 바뀌면 해시도 바뀐다', () => {
    const [a] = readCaseDirs([imageCase(PNG)]);
    expect(a!.assets).toEqual([
      expect.objectContaining({ name: 'hint-1.png', mime: 'image/png', bytes: PNG }),
    ]);
    const [b] = readCaseDirs([imageCase(Buffer.concat([PNG, Buffer.from([1])]))]);
    expect(b!.hash).not.toBe(a!.hash);
  });

  it('이미지가 없는 사건의 해시는 예전 방식과 같다(기존 버전 재적재 시 오류 방지)', () => {
    const [t] = readCaseDirs([publicRoot]).filter((c) => c.content.isTutorial);
    expect(t!.assets).toEqual([]);
    expect(t!.hash).toBe(contentHash(t!.content));
  });

  it('파일이 없거나, 확장자와 내용이 다르거나, 너무 크면 거부한다', () => {
    expect(() => readCaseDirs([imageCase(null)])).toThrow(/images\/hint-1\.png: file not found/);
    expect(() => readCaseDirs([imageCase(Buffer.from('GIF89a....'))])).toThrow(
      /does not match its extension/,
    );
    const big = Buffer.concat([PNG, Buffer.alloc(IMAGE_MAX_BYTES)]);
    expect(() => readCaseDirs([imageCase(big)])).toThrow(/larger than/);
  });

  it('글 힌트와 이미지 힌트 필드를 섞으면 거부하고, SVG는 받지 않는다', () => {
    expect(hintSchema.safeParse({ no: 1, text: '글', image: 'a.png', alt: '대체' }).success).toBe(
      false,
    );
    expect(hintSchema.safeParse({ no: 1, image: 'a.svg', alt: '대체' }).success).toBe(false);
    expect(hintSchema.safeParse({ no: 2, image: 'a.webp', alt: '대체' }).success).toBe(true);
  });

  it('단서 이미지는 대체 텍스트가 있어야 하고, 이미지 힌트는 대체 텍스트로 인물 표기를 검사한다', () => {
    const e: ExploreContent = {
      maps: [
        {
          key: 'a',
          name: '방',
          grid: ['#####', '#...#', '#####'],
          exits: [],
          unlock: { type: 'OPEN' },
        },
      ],
      spawn: { x: 1, y: 1 },
      objects: [
        { key: 'desk', map: 'a', x: 3, y: 1, name: '책상', description: '책상', clue: 'note' },
      ],
      npcs: [],
      clues: [
        {
          key: 'note',
          kind: 'ITEM',
          title: '쪽지',
          content: '쪽지',
          decoy: false,
          image: 'note.png',
        },
      ],
    };
    expect(exploreIssues(e, { factIds: [] })).toContain('clue note: image needs alt text');
    expect(
      personNamingIssues({
        caseFile: { people: [{ name: '오만식', role: '관리인' }] },
        facts: [],
        hints: [{ no: 1, image: 'h.png', alt: '오만식의 순찰 일지' }],
        elements: [],
      }),
    ).toEqual(['hint 1: write "관리인 오만식" instead of "오만식"']);
  });
});

describe('맵 배경(D94)', () => {
  it('PNG·JPEG·WebP 머리말에서 크기를 읽는다', () => {
    const png = readFileSync(join(publicRoot, 'sample', 'images', 'living-bg.png'));
    expect(imageSize(png)).toEqual({ width: 448, height: 288 });
    // JPEG: SOI + APP0(길이 4) + SOF0(높이 0x0120=288, 너비 0x01C0=448)
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x20,
      0x01, 0xc0, 0x03,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 448, height: 288 });
    // WebP VP8X: 캔버스 너비-1, 높이-1(24비트 리틀 엔디언)
    const webp = new Uint8Array(30);
    webp.set([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8X')]);
    webp.set([0xbf, 0x01, 0x00, 0x1f, 0x01, 0x00], 24); // 447+1, 287+1
    expect(imageSize(webp)).toEqual({ width: 448, height: 288 });
    expect(imageSize(Uint8Array.from([1, 2, 3]))).toBeNull();
  });

  it('배경이 격자 크기(칸 × 32px)의 1~3배가 아니면 거부한다', () => {
    const c = JSON.parse(readFileSync(join(publicRoot, 'sample', 'case.json'), 'utf8'));
    const root = mkdtempSync(join(tmpdir(), 'mt-bg-'));
    mkdirSync(join(root, 's', 'images'), { recursive: true });
    for (const f of ['living-bg.png', 'light-switch.png'])
      writeFileSync(
        join(root, 's', 'images', f),
        readFileSync(join(publicRoot, 'sample', 'images', f)),
      );
    // 거실 배경(448×288)을 크기가 다른 현관·복도에 붙인다
    c.maps.find((m: { key: string }) => m.key === 'hall').background = 'living-bg.png';
    writeFileSync(join(root, 's', 'case.json'), JSON.stringify(c));
    expect(() => readCaseDirs([root])).toThrow(
      /map hall: background living-bg\.png is 448x288, expected 448x160 \(or 2x, 3x\)/,
    );
  });

  it('배경 그림도 사건 이미지로 함께 적재한다', () => {
    const [s] = readCaseDirs([publicRoot]).filter((c) => c.content.slug === 'sample-blackout-302');
    expect(s!.assets.map((a) => a.name).sort()).toEqual(['light-switch.png', 'living-bg.png']);
  });
});
