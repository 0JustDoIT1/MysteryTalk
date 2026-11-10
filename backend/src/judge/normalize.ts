import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from '@mysterytalk/shared';

const GRAPHEMES = new Intl.Segmenter('ko', { granularity: 'grapheme' });

/**
 * 질문 입력 정규화(SPEC §6-3): NFC, 제어문자 제거, 연속 공백 정리, 앞뒤 공백 제거.
 * 길이(2~100자, PRD D8)를 벗어나면 null.
 */
export function normalizeQuestion(raw: string): string | null {
  const text = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // 사람이 보는 글자 단위로 센다(이모지·결합 문자도 1글자).
  const length = Array.from(GRAPHEMES.segment(text)).length;
  if (length < QUESTION_MIN_LENGTH || length > QUESTION_MAX_LENGTH) return null;
  return text;
}

/**
 * 같은 문장 판정용 키(SPEC §6-4, PRD D5): 공백·문장부호·기호를 모두 지우고 소문자로.
 * "열쇠가 세탁소에 있나요?" 와 "열쇠가세탁소에 있나요" 는 같은 질문으로 본다.
 */
export function duplicateKey(normalized: string): string {
  return normalized.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}
