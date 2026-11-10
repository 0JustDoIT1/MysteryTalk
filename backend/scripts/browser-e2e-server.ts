import { spawn } from 'node:child_process';
import prepareTestDb from '../test/global-setup.js';

/**
 * 브라우저 E2E(Playwright)용 백엔드: `npm run e2e:server -w backend`
 * DATABASE_URL_BROWSER(이름이 `_test`로 끝나는 DB만 허용) 준비 → 마이그레이션 → 공개 사건 적재 → 서버 시작.
 * AI는 항상 Mock(판정: 관계없음, 채점: 키워드 기준)이라 결과가 결정적이다.
 */
const url = process.env['DATABASE_URL_BROWSER'];
if (!url) throw new Error('DATABASE_URL_BROWSER is required for browser e2e');
process.env['DATABASE_URL_TEST'] = url;
await prepareTestDb();

const env = {
  ...process.env,
  DATABASE_URL: url,
  LLM_PROVIDER: 'mock',
  PORT: process.env['PORT'] ?? '4100',
};
const run = (cmd: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, {
      shell: true,
      stdio: 'inherit',
      env,
      cwd: new URL('..', import.meta.url),
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
await run('npx tsx scripts/load-content.ts');
await run('npx nest start');
