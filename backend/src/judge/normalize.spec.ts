import { duplicateKey, normalizeQuestion } from './normalize.js';

describe('normalizeQuestion (SPEC §6-3, PRD D8)', () => {
  it('앞뒤 공백 제거, 연속 공백·제어문자를 한 칸으로', () => {
    expect(normalizeQuestion('  열쇠가\n\t세탁소에   있나요?  ')).toBe('열쇠가 세탁소에 있나요?');
  });

  it('NFC로 정규화한다(분해된 한글도 같은 문장)', () => {
    const decomposed = '열쇠'.normalize('NFD');
    expect(normalizeQuestion(`${decomposed}인가요`)).toBe('열쇠인가요');
  });

  it('길이 경계: 1자 거부, 2자 허용, 100자 허용, 101자 거부', () => {
    expect(normalizeQuestion('가')).toBeNull();
    expect(normalizeQuestion('가나')).toBe('가나');
    expect(normalizeQuestion('가'.repeat(100))).toBe('가'.repeat(100));
    expect(normalizeQuestion('가'.repeat(101))).toBeNull();
  });

  it('공백만 있으면 거부', () => {
    expect(normalizeQuestion('     ')).toBeNull();
  });

  it('이모지는 한 글자로 센다', () => {
    expect(normalizeQuestion(`${'가'.repeat(99)}👩‍👩‍👧`)).not.toBeNull();
  });
});

describe('duplicateKey (PRD D5)', () => {
  it('공백·문장부호·대소문자만 다른 문장은 같은 키', () => {
    expect(duplicateKey('열쇠가 세탁소에 있나요?')).toBe(duplicateKey('열쇠가세탁소에 있나요!!'));
    expect(duplicateKey('Key in LAUNDRY?')).toBe(duplicateKey('key in laundry'));
  });

  it('표현이 다르면 다른 키(의미 중복은 새 질문)', () => {
    expect(duplicateKey('열쇠는 세탁소에 있나요?')).not.toBe(
      duplicateKey('열쇠가 세탁소에 있나요?'),
    );
  });
});
