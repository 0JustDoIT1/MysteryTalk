import { expect, test, type Page } from '@playwright/test';

/**
 * 시작부터 엔딩까지(PRD §14 E2·E3·E4·E7 해당 부분, 텍스트·PC).
 * Mock AI: 질문 판정은 항상 '관계없음'(차감), 채점은 정답 요소 키워드 기준.
 * 테스트마다 새 브라우저 컨텍스트 = 새 게스트라 서로 영향이 없다.
 */

async function ask(page: Page, question: string, expectedUsed: number) {
  const input = page.getByLabel('예/아니오로 답할 수 있는 질문');
  await input.fill(question);
  await input.press('Enter'); // 키보드만으로 질문(D66)
  await expect(page.getByText(`Q. ${question}`)).toBeVisible();
  await expect(page.getByText(new RegExp(`질문 ${expectedUsed} / 기준`))).toBeVisible();
}

async function openCase(page: Page, title: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '사건 선택' })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await page.getByRole('button', { name: '수사 시작' }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]+$/);
}

async function submitAnswer(page: Page, answer: string) {
  await page.getByRole('button', { name: '정답 제출' }).click();
  const dialog = page.getByRole('dialog', { name: '정답 제출' });
  await dialog.getByLabel('사건의 진상을 자유롭게 써 주세요').fill(answer);
  await dialog.getByRole('button', { name: '제출하기' }).click();
  return dialog;
}

test('본편 샘플: 질문 → 힌트 → 질문 기록 → 오답 → 정답 → 엔딩 → 목록 기록', async ({ page }) => {
  await openCase(page, '302호의 정전');

  // 기준 질문 20개 → 힌트 1은 질문 7개째에 열린다(⌈20/3⌉).
  for (let i = 1; i <= 7; i += 1) await ask(page, `연습 질문 ${i}번인가요?`, i);
  const verdict = page.locator('[aria-live="polite"]').filter({ hasText: 'Q. 연습 질문 7번' });
  await expect(verdict.getByText('관계없음')).toBeVisible();
  await expect(page.getByRole('status').getByText('힌트 1이(가) 열렸어요.')).toBeVisible();

  await page.getByRole('button', { name: '힌트 1 열기' }).click();
  await expect(page.getByText(/정전은 정말 건물 전체에/)).toBeVisible();
  await expect(page.getByText('열람한 힌트 1개')).toBeVisible();

  // 수첩 탭·필터는 URL 상태
  await page.getByRole('tab', { name: '질문 기록' }).click();
  await expect(page).toHaveURL(/tab=questions/);
  await page
    .getByRole('group', { name: '판정별 보기' })
    .getByRole('button', { name: '관계없음' })
    .click();
  await expect(page).toHaveURL(/filter=IRRELEVANT/);
  await expect(page.getByRole('tabpanel').getByRole('listitem')).toHaveCount(7);

  // 오답: 맞힌 핵심 요소 개수만 알려 준다
  const dialog = await submitAnswer(page, '관리인 오만식이 독을 먹여 죽였다고 생각합니다.');
  await expect(dialog.getByText('핵심 요소 3개 중 0개를 맞혔어요.')).toBeVisible();
  await expect(dialog.getByText('남은 제출 기회 2회')).toBeVisible();

  // 정답 → 엔딩(100 - 힌트 10 - 오답 10 = 80 → A)
  await dialog
    .getByLabel('사건의 진상을 자유롭게 써 주세요')
    .fill('조카 문태성이 돈 문제로 다투다 한정숙을 밀쳐 죽게 하고 차단기를 내려 사고로 꾸몄다.');
  await dialog.getByRole('button', { name: '제출하기' }).click();
  await expect(page).toHaveURL(/\/ending$/);
  await expect(page.getByRole('heading', { name: '사건 결과' })).toBeVisible();
  await expect(page.getByText('점수 80')).toBeVisible();
  await expect(page.getByText('A', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '진상 해설' })).toBeVisible();
  await expect(page.getByText(/차단기를 내려 집을 캄캄하게/)).toBeVisible();
  // 본편 엔딩에는 튜토리얼용 규칙 설명이 없다
  await expect(page.getByText(/튜토리얼은 연습이라/)).toHaveCount(0);

  await page.getByRole('link', { name: '목록으로' }).click();
  const card = page.getByRole('link', { name: /302호의 정전/ });
  await expect(card.getByText(/해결 · 최고 A · 1회차 달성 · 총 1회/)).toBeVisible();
});

test('튜토리얼: 단계 안내를 따라 해결하고, 엔딩에 점수와 감점 규칙 설명을 보여 준다', async ({
  page,
}) => {
  await openCase(page, '사라진 금고 열쇠');
  const guide = page.getByRole('complementary', { name: '튜토리얼 안내' });
  await expect(guide.getByText(/1\/5/)).toBeVisible();
  await ask(page, '열쇠를 도둑맞았나요?', 1);
  await expect(guide.getByText(/2\/5/)).toBeVisible();

  await submitAnswer(
    page,
    '제빵사 강민호가 앞치마 주머니에 열쇠를 넣은 채 세탁 자루에 넣었다. 도난이 아니다.',
  );
  await expect(page).toHaveURL(/\/ending$/);
  await expect(page.getByText('점수 100')).toBeVisible();
  await expect(page.getByText(/튜토리얼은 연습이라 기록에 남지 않아요/)).toBeVisible();
  await expect(page.getByText(/질문이 기준\(15개\)을 넘으면 1개당 2점/)).toBeVisible();

  await page.getByRole('link', { name: '목록으로' }).click();
  const card = page.getByRole('link', { name: /사라진 금고 열쇠/ });
  await expect(card.getByText(/최고/)).toHaveCount(0);
});

test('수사 포기: 확인 창 → F 기록과 진상 해설 공개', async ({ page }) => {
  await openCase(page, '302호의 정전');
  await page.getByRole('button', { name: '수사 포기' }).click();
  const dialog = page.getByRole('dialog', { name: '수사를 포기할까요?' });
  await expect(dialog.getByText(/F가 기록되고/)).toBeVisible();
  await dialog.getByRole('button', { name: '포기하기' }).click();
  await expect(page).toHaveURL(/\/ending$/);
  await expect(page.getByText('F', { exact: true })).toBeVisible();
  await expect(page.getByText('해결하지 못해 점수가 없어요.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '진상 해설' })).toBeVisible();
});

test('질문 입력 경계: 같은 문장 재질문은 차감되지 않는다', async ({ page }) => {
  await openCase(page, '302호의 정전');
  await ask(page, '정전이 있었나요?', 1);
  const input = page.getByLabel('예/아니오로 답할 수 있는 질문');
  await input.fill('정전이 있었나요');
  await input.press('Enter');
  await expect(page.getByText('이미 한 질문이에요. 질문 수는 차감되지 않았어요.')).toBeVisible();
  await expect(page.getByText(/질문 1 \/ 기준 20/)).toBeVisible();
});

/** 맵에 포커스를 두고 같은 방향으로 n칸 걷는다(한 칸 간격 0.11초보다 길게 기다림). */
async function walk(page: Page, key: string, n: number) {
  for (let i = 0; i < n; i += 1) {
    await page.keyboard.press(key);
    await page.waitForTimeout(140);
  }
}

test('현장 조사: 걸어가 조사 → 단서 획득 → 수첩 단서 → 맵 이동 → 단서로 새 장소 열림 → 위치 복원', async ({
  page,
}) => {
  await openCase(page, '302호의 정전');
  const map = page.getByRole('application', { name: '현장 조사' });
  await expect(page.getByText('현재 위치: 302호 거실')).toBeVisible();
  await map.click();

  // 시작 (6,6) → 위로 5칸 (6,1) → 오른쪽 5칸 (11,1): 전등 스위치 옆
  await walk(page, 'ArrowUp', 5);
  await walk(page, 'ArrowRight', 5);
  await expect(page.getByText('가까이: 전등 스위치 — E·Enter로 조사')).toBeVisible();
  await page.keyboard.press('e');
  const dialog = page.getByRole('dialog', { name: '전등 스위치' });
  await expect(dialog.getByText(/단서를 찾았어요: 켜져 있는 전등 스위치/)).toBeVisible();
  await dialog.getByRole('button', { name: '닫기' }).click();

  // 다시 조사하면 '이미 조사함'
  await map.click();
  await page.keyboard.press('e');
  await expect(page.getByText('이미 조사한 곳이에요. 단서는 수첩에 있어요.')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: '단서' }).click();
  await expect(page.getByRole('tabpanel').getByText('켜져 있는 전등 스위치')).toBeVisible();

  // 질문창에 입력할 때는 캐릭터가 움직이지 않는다
  const input = page.getByLabel('예/아니오로 답할 수 있는 질문');
  await input.fill('dddd');
  await expect(page.getByText('가까이: 전등 스위치 — E·Enter로 조사')).toBeVisible();
  await input.fill('');

  // 출입구 (6,8)로 걸어가 현관·복도(6,1)로 이동
  await map.click();
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowDown', 7);
  await expect(page.getByText('현재 위치: 현관·복도')).toBeVisible();

  // 두꺼비집 옆 (2,1)에서 조사 → 빌라 관리실이 열린다(단서 해금)
  await walk(page, 'ArrowLeft', 4);
  await expect(page.getByText('가까이: 두꺼비집 — E·Enter로 조사')).toBeVisible();
  await page.keyboard.press('e');
  await expect(
    page.getByRole('dialog', { name: '두꺼비집' }).getByText(/내려진 차단기/),
  ).toBeVisible();
  await expect(page.getByRole('status').getByText('새 장소가 열렸어요: 빌라 관리실')).toBeVisible();
  await page.keyboard.press('Escape');

  // 새로고침해도 서버에 저장된 위치에서 이어진다(D53)
  await page.reload();
  await expect(page.getByText('현재 위치: 현관·복도')).toBeVisible();
  await expect(page.getByText('가까이: 두꺼비집 — E·Enter로 조사')).toBeVisible();
});
