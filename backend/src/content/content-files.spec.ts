import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exploreIssues, personNamingIssues, type ExploreContent } from '@mysterytalk/shared';
import { evalSetSchema } from '../eval/eval-set.js';
import { readCaseDirs } from './content-files.js';

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
      hints: [{ no: 1, text: '관리인 오만식에게 물어보세요.' }],
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
          'clue note: must be linked to exactly one object or npc',
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
  });
});
