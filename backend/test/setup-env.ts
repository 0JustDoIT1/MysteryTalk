import 'dotenv/config';

// 각 테스트 워커에서 앱이 테스트 DB에 연결하도록 DATABASE_URL 을 덮어쓴다.
if (process.env['DATABASE_URL_TEST']) {
  process.env['DATABASE_URL'] = process.env['DATABASE_URL_TEST'];
}
