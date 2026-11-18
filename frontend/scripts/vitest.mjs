/**
 * vitest 실행 래퍼(Windows 드라이브 글자 대소문자 맞추기).
 *
 * Windows에서 작업 폴더가 소문자 드라이브(`d:\...`)로 잡히면 vitest 본체는 소문자 경로로,
 * 테스트 파일의 `import ... from 'vitest'`는 Vite가 실제 경로(`D:\...`)로 풀어 두 벌이 로드된다.
 * 그러면 모든 테스트 파일이 `describe(`에서 "Cannot read properties of undefined (reading 'config')"로 실패한다.
 * 같은 명령이 VS Code 터미널·npm 워크스페이스 실행(소문자)에서는 실패하고 cmd(대문자)에서는 통과해
 * 간헐 실패처럼 보였다(2026-11-18 확인). 백엔드는 전역 API(globals)를 써서 직접 import하지 않아 영향이 없다.
 *
 * 그래서 드라이브 글자를 대문자로 바꾼 작업 폴더에서 vitest를 자식 프로세스로 실행한다.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const pkgPath = createRequire(join(cwd, 'package.json')).resolve('vitest/package.json');
const bin = join(dirname(pkgPath), 'vitest.mjs');
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
