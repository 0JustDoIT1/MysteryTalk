import { resolve } from 'node:path';
import { dayKey, ipHash, monthKey } from './keys.js';
import { parseNotice, readNotices } from './notices.js';
import { PRICES, estimateCostKrw } from './pricing.js';

describe('운영 집계 단위 (SPEC §10)', () => {
  it('하루·한 달은 한국 시간 기준으로 자른다', () => {
    // UTC 14:59 = 한국 23:59, UTC 15:00 = 한국 다음 날 00:00
    expect(dayKey(new Date('2026-11-30T14:59:00Z'))).toBe('2026-11-30');
    expect(dayKey(new Date('2026-11-30T15:00:00Z'))).toBe('2026-12-01');
    expect(monthKey(new Date('2026-11-30T15:00:00Z'))).toBe('2026-12');
  });

  it('IP 해시는 원문을 담지 않고, 날짜·비밀값이 바뀌면 달라진다', () => {
    const a = ipHash('203.0.113.7', 'secret-secret-123', '2026-11-12');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203.0.113.7');
    expect(ipHash('203.0.113.7', 'secret-secret-123', '2026-11-13')).not.toBe(a);
    expect(ipHash('203.0.113.7', 'other-secret-4567', '2026-11-12')).not.toBe(a);
  });
});

describe('AI 단가 (SPEC §10)', () => {
  it('로컬·테스트 모델은 0원, 단가가 있으면 토큰 수로 계산한다', () => {
    expect(estimateCostKrw('gemma3:12b', 2000, 30)).toBe(0);
    expect(estimateCostKrw('mock', 2000, 30)).toBe(0);
    PRICES['test-cloud'] = { inPerMillion: 1000, outPerMillion: 4000 };
    expect(estimateCostKrw('test-cloud', 1_000_000, 500_000)).toBe(3000);
    delete PRICES['test-cloud'];
  });
});

describe('공지 파일 (PRD D41)', () => {
  it('머리말의 제목·날짜와 본문을 읽는다', () => {
    expect(parseNotice('hello', '---\ntitle: 안녕\ndate: 2026-11-12\n---\n본문입니다.\n')).toEqual({
      id: 'hello',
      title: '안녕',
      date: '2026-11-12',
      body: '본문입니다.',
    });
  });

  it.each([
    ['머리말 없음', '본문만'],
    ['날짜 형식', '---\ntitle: 안녕\ndate: 11월 12일\n---\n본문'],
    ['제목 없음', '---\ndate: 2026-11-12\n---\n본문'],
  ])('형식이 틀리면 파일 이름과 함께 실패한다: %s', (_name, text) => {
    expect(() => parseNotice('bad', text, 'bad.md')).toThrow(/bad\.md/);
  });

  it('저장소의 공지 파일은 모두 형식을 지키고 최신순으로 정렬된다', () => {
    const notices = readNotices(resolve(import.meta.dirname, '../../../content/notices'));
    expect(notices.length).toBeGreaterThan(0);
    const dates = notices.map((n) => n.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
