// 저장소 규칙 검사(CI·로컬 공용): npm run guard
// - 테스트 파일에 .only / .skip(.each·.skipIf 등 변형 포함) / .todo / .fixme 금지
//   (테스트를 건너뛰어 통과시키지 않는다, CLAUDE.md 5장)
// - content/public 에는 튜토리얼·샘플만(본편 사건 데이터는 공개 저장소에 넣지 않는다, PRD D85)
// - Claude Code 가드 훅 규칙 검사(.claude/hooks/guard-bash.test.mjs)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// -z: 한글 등 비ASCII 경로를 따옴표·8진수로 감싸지 않고 그대로 받는다.
// existsSync: 지웠지만 아직 스테이징하지 않은 파일은 건너뛴다.
const files = execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter((f) => f && existsSync(f));
const problems = [];

const testFile = /\.(test|spec|e2e-spec)\.(ts|tsx|js|mjs)$/;
// .each·.concurrent 체인과 .skipIf·.todo·Playwright .fixme 같은 변형도 잡는다
const focusOrSkip =
  /\b(it|test|describe)(\.(concurrent|sequential|each))*\.(only|skip|skipIf|todo|fixme)\b/;
for (const f of files.filter((f) => testFile.test(f) && !f.startsWith('.claude/'))) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (focusOrSkip.test(line)) {
        problems.push(`${f}:${i + 1} 테스트를 건너뛰거나 하나만 실행하는 표시(.only/.skip 등)`);
      }
    });
}

const allowedCases = new Set(['tutorial', 'sample']);
const caseDirs = new Set(
  files
    .filter((f) => f.startsWith('content/public/'))
    .map((f) => f.split('/'))
    .filter((parts) => parts.length > 3)
    .map((parts) => parts[2]),
);
for (const dir of caseDirs) {
  if (!allowedCases.has(dir)) {
    problems.push(`content/public/${dir} — 공개 저장소에는 튜토리얼·샘플 사건만 둡니다`);
  }
}

if (problems.length > 0) {
  console.error(`저장소 규칙 위반 ${problems.length}건:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('저장소 규칙 검사 통과');

await import('../.claude/hooks/guard-bash.test.mjs');
