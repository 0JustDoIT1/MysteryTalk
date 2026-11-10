import {
  ANSWER_MAX_LENGTH,
  ANSWER_MIN_LENGTH,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
} from '@mysterytalk/shared';

const GRAPHEMES = new Intl.Segmenter('ko', { granularity: 'grapheme' });

/**
 * 입력 정규화(SPEC §6-3, §7-1): NFC, 제어문자 제거, 연속 공백 정리, 앞뒤 공백 제거.
 * 사람이 보는 글자 단위(grapheme)로 길이를 세고 [min, max]를 벗어나면 null.
 */
export function normalizeText(raw: string, min: number, max: number): string | null {
  const text = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const length = Array.from(GRAPHEMES.segment(text)).length;
  if (length < min || length > max) return null;
  return text;
}

/** 질문 입력 정규화. 길이 2~100자(PRD D8) */
export function normalizeQuestion(raw: string): string | null {
  return normalizeText(raw, QUESTION_MIN_LENGTH, QUESTION_MAX_LENGTH);
}

/** 정답 입력 정규화. 길이 10~300자(PRD D79) */
export function normalizeAnswer(raw: string): string | null {
  return normalizeText(raw, ANSWER_MIN_LENGTH, ANSWER_MAX_LENGTH);
}

/**
 * 같은 문장 판정용 키(SPEC §6-4, PRD D5): 공백·문장부호·기호를 모두 지우고 소문자로.
 * "열쇠가 세탁소에 있나요?" 와 "열쇠가세탁소에 있나요" 는 같은 질문으로 본다.
 */
export function duplicateKey(normalized: string): string {
  return normalized.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}
