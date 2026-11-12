import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readCaseDirs } from '../src/content/content-files.js';
import { evalSetSchema } from '../src/eval/eval-set.js';

/**
 * 사건 데이터 검사(DB 없이): `npm run content:check -w backend`
 * 공개 사건(content/public) + 비공개 사건(CASE_DATA_DIR)의 case.json 형식·자동 검사와
 * eval.json 형식(질문 30개 이상·답안 8개 이상, PRD D65)을 확인한다. 하나라도 틀리면 실패한다.
 */
const roots = [resolve(import.meta.dirname, '../../content/public')];
if (process.env['CASE_DATA_DIR']) roots.push(resolve(process.env['CASE_DATA_DIR']));

const problems: string[] = [];
const cases = readCaseDirs(roots);
for (const c of cases) {
  const file = join(c.dir, 'eval.json');
  if (!existsSync(file)) {
    problems.push(`${c.content.slug}: eval.json 없음`);
    continue;
  }
  const parsed = evalSetSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    problems.push(
      `${c.content.slug}: eval.json 형식 오류 ${parsed.error.issues[0]?.path.join('.')}`,
    );
    continue;
  }
  const e = parsed.data;
  if (e.caseSlug !== c.content.slug) problems.push(`${c.content.slug}: eval.json caseSlug 불일치`);
  if (e.questions.length < 30)
    problems.push(`${c.content.slug}: 평가 질문 ${e.questions.length}개(30개 이상 필요)`);
  if (e.answers.length < 8)
    problems.push(`${c.content.slug}: 채점 답안 ${e.answers.length}개(8개 이상 필요)`);
  console.log(
    `ok  ${c.content.slug} v${c.content.version} · 사실 ${c.content.facts.length} · 맵 ${c.content.maps.length} · 단서 ${c.content.clues.length} · 질문 ${e.questions.length} · 답안 ${e.answers.length}`,
  );
}
if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
  process.exit(1);
}
console.log(`${cases.length}건 통과`);
