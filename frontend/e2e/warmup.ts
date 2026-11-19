import type { FullConfig } from '@playwright/test';

/**
 * 테스트 전에 모든 페이지를 한 번씩 열어 `next dev`의 첫 방문 컴파일을 끝내 둔다.
 * 컴파일은 페이지마다 처음 한 번만 일어나는데, 컴퓨터가 바쁘면 10초를 넘겨 화면 이동을 기다리는
 * 5초 단언이 앱과 관계없이 실패했다(2026-11-19 확인: API는 1초 미만, 첫 페이지 응답 11.7초).
 * 동적 경로는 아무 값으로 열어도 같은 코드가 컴파일된다.
 */
const PAGES = [
  '/',
  '/cases',
  '/cases/warmup',
  '/continue',
  '/notices',
  '/settings',
  '/privacy',
  '/terms',
  '/play/00000000-0000-0000-0000-000000000000',
  '/play/00000000-0000-0000-0000-000000000000/ending',
];

export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('baseURL이 없습니다');
  for (const path of PAGES) {
    const res = await fetch(new URL(path, baseURL), { signal: AbortSignal.timeout(180_000) });
    // 내용이 아니라 컴파일이 목적이라 상태 코드는 따지지 않되, 서버 오류는 알린다
    if (res.status >= 500) throw new Error(`미리 열기 실패: ${path} → ${res.status}`);
    await res.arrayBuffer();
  }
}
