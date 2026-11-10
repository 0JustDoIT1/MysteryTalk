import { agree, decide, failedStatus, keywordMatch, type ElementForGrading } from './decide.js';

const elements: ElementForGrading[] = [
  { id: 'A1', required: true, keywordGroups: [['문태성', '조카']] },
  { id: 'A2', required: true, keywordGroups: [['밀쳐', '밀었']] },
  {
    id: 'A3',
    required: true,
    keywordGroups: [
      ['차단기', '두꺼비집'],
      ['위장', '꾸몄'],
    ],
  },
  { id: 'A4', required: false, keywordGroups: [['돈']] },
];
const all = (v: 'MATCH' | 'NO_MATCH' | 'UNCLEAR') => ({ A1: v, A2: v, A3: v, A4: v });

describe('키워드 판정 (SPEC §7-4)', () => {
  it('그룹 안은 OR, 그룹 사이는 AND', () => {
    expect(keywordMatch('차단기를 내려 사고로 위장', elements[2]!.keywordGroups)).toBe(true);
    expect(keywordMatch('차단기를 내렸다', elements[2]!.keywordGroups)).toBe(false);
  });

  it('공백·문장부호·대소문자를 무시한다', () => {
    expect(keywordMatch('두꺼비 집을 내리고, 꾸몄다!', elements[2]!.keywordGroups)).toBe(true);
    expect(keywordMatch('Key 를 찾음', [['key']])).toBe(true);
  });
});

describe('요소별 합의 (SPEC §7-5, PRD D20)', () => {
  it.each([
    [true, 'MATCH', 'MATCH'],
    [false, 'NO_MATCH', 'MISS'],
    [true, 'NO_MATCH', 'UNCLEAR'],
    [false, 'MATCH', 'UNCLEAR'],
    [true, 'UNCLEAR', 'UNCLEAR'],
    [false, 'UNCLEAR', 'UNCLEAR'],
  ] as const)('키워드 %s + AI %s → %s', (keyword, ai, expected) => {
    expect(agree(keyword, ai)).toBe(expected);
  });
});

describe('제출 결과 결정 (SPEC §7-6)', () => {
  const full = '조카 문태성이 밀쳐 죽이고 차단기를 내려 사고로 위장했다. 돈 문제였다.';

  it('필수 요소가 모두 확정 일치하면 해결(선택 요소는 무관)', () => {
    const d = decide(elements, full, { ...all('MATCH'), A4: 'NO_MATCH' }, false);
    expect(d).toMatchObject({ result: 'SOLVED', matchedCount: 3, totalCount: 3 });
  });

  it('필수 요소에 확정 불일치가 있으면 오답, 개수는 확정 일치한 필수 요소만', () => {
    const d = decide(elements, '조카 문태성이 독을 먹였다', all('NO_MATCH'), false);
    expect(d.result).toBe('WRONG');
    const d2 = decide(
      elements,
      '조카 문태성이 독을 먹였다',
      { ...all('NO_MATCH'), A1: 'MATCH' },
      false,
    );
    expect(d2).toMatchObject({ result: 'WRONG', matchedCount: 1, totalCount: 3 });
  });

  it('필수 요소에 미확정만 남으면 재작성 요청', () => {
    // 키워드는 모두 맞지만 AI가 A3을 불일치로 봄 → 미확정
    const d = decide(elements, full, { ...all('MATCH'), A3: 'NO_MATCH' }, false);
    expect(d.result).toBe('NEEDS_DETAIL');
  });

  it('선택 요소의 불일치는 결과에 영향이 없다', () => {
    const d = decide(elements, full, { ...all('MATCH'), A3: 'UNCLEAR', A4: 'NO_MATCH' }, false);
    expect(d.result).toBe('NEEDS_DETAIL');
  });

  it('재작성 요청을 다 쓰면 미확정을 AI 판정으로 확정한다(D23). AI도 모호하면 불일치', () => {
    expect(decide(elements, full, { ...all('MATCH'), A3: 'NO_MATCH' }, true).result).toBe('WRONG');
    expect(decide(elements, full, { ...all('MATCH'), A3: 'UNCLEAR' }, true).result).toBe('WRONG');
    // 키워드가 없어도 AI가 일치로 보면 확정 단계에서는 일치
    expect(decide(elements, '태성이가 떠밀고 전원을 내려 꾸몄다', all('MATCH'), true).result).toBe(
      'SOLVED',
    );
  });
});

describe('부분 해결 기준 (PRD D69)', () => {
  it.each([
    [0, 3, 'FAILED'],
    [1, 3, 'FAILED'],
    [2, 3, 'PARTIAL'],
    [1, 2, 'PARTIAL'],
    [0, 2, 'FAILED'],
    [2, 4, 'PARTIAL'],
  ] as const)('필수 %i/%i 충족 → %s', (matched, total, expected) => {
    expect(failedStatus(matched, total)).toBe(expected);
  });
});
