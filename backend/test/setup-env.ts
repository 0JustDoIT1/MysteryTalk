import 'dotenv/config';

// 각 테스트 워커에서 앱이 테스트 DB에 연결하도록 DATABASE_URL 을 덮어쓴다.
if (process.env['DATABASE_URL_TEST']) {
  process.env['DATABASE_URL'] = process.env['DATABASE_URL_TEST'];
}

// 개발용 backend/.env 값이 테스트 결과를 바꾸지 않게 고정한다(CI와 같은 조건).
// AI는 Mock(판정기를 넘기지 않은 테스트도 실제 AI를 부르지 않음), 주소는 helpers 의 TEST_PUBLIC_BASE_URL,
// 한도·예산은 없음(한도를 시험하는 ops e2e 는 파일 안에서 다시 바꾼다).
Object.assign(process.env, {
  LLM_PROVIDER: 'mock',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  DAILY_LIMIT_GUEST: '0',
  DAILY_LIMIT_USER: '0',
  DAILY_LIMIT_TUTORIAL: '0',
  MONTHLY_AI_BUDGET_KRW: '0',
});
delete process.env['CASE_DATA_DIR'];
