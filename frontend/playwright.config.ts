import { defineConfig, devices } from '@playwright/test';

/**
 * 브라우저 E2E(SPEC §14, PRD §14 E2~E8 해당 부분). AI는 Mock이라 결과가 결정적이다.
 * 실행: `npm run test:browser` (DATABASE_URL_BROWSER 필요, DB 이름은 `_test`로 끝나야 함)
 * 개발 서버(3000/4000)와 겹치지 않게 3100/4100 포트를 쓴다.
 */
const backendPort = 4100;
const frontendPort = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'retain-on-failure',
    locale: 'ko-KR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run e2e:server -w backend',
      cwd: '..',
      url: `http://localhost:${backendPort}/health`,
      env: { PORT: String(backendPort) },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
    },
    {
      command: `npx next dev --port ${frontendPort}`,
      url: `http://localhost:${frontendPort}`,
      env: { BACKEND_URL: `http://localhost:${backendPort}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
