import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evalSetSchema } from '../eval/eval-set.js';
import { readCaseDirs } from './content-files.js';

const publicRoot = resolve(import.meta.dirname, '../../../content/public');

describe('사건 데이터 파일 (SPEC §11)', () => {
  it('공개 사건(튜토리얼)은 형식 검사를 통과하고 평가 세트도 유효하다', () => {
    const cases = readCaseDirs([publicRoot]);
    const tutorial = cases.find((c) => c.content.isTutorial);
    expect(tutorial?.content.slug).toBe('tutorial-missing-key');
    const evalSet = evalSetSchema.parse(
      JSON.parse(readFileSync(join(tutorial!.dir, 'eval.json'), 'utf8')),
    );
    expect(evalSet.caseSlug).toBe(tutorial!.content.slug);
    expect(evalSet.questions.length).toBeGreaterThanOrEqual(30);
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
});
