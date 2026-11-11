/**
 * AI 호출 전 사전 필터(SPEC §6-7, PRD D57).
 * 욕설과 '판정 규칙을 무시·변경하라'는 명백한 조작 지시만 걸러 '다시 질문(ABUSE)'으로 처리한다.
 * 사건 질문에 쓰일 수 있는 일반 단어(예: '지시', '명령')만으로는 걸지 않는다.
 * 여기서 놓친 시도는 AI가 RETRY/ABUSE로 판정하고, 어떤 경우에도 판정 결과는 허용된 라벨 안에서만 나온다.
 */

const PROFANITY = [
  /씨\s*발/,
  /시\s*발/,
  /ㅅㅂ/,
  /병\s*신/,
  /ㅂㅅ/,
  /좆/,
  /개새끼/,
  /\bfuck/i,
  /\bshit\b/i,
];

// AI에게 내리는 명령형만 잡는다. "범인이 명령을 무시했나요?" 같은 사건 질문은 통과해야 한다.
const INJECTION = [
  /(이전|앞|위)의?\s*(지시|명령|규칙|설정|프롬프트)[^?]{0,10}(무시하고|무시해|무시하세요|무시하라|잊어|잊고)/,
  /(지시|명령|규칙)\s*(을|를|은|는)?\s*(모두\s*|전부\s*)?(무시하고|무시해|무시하세요|무시하라)/,
  /시스템\s*프롬프트/,
  /system\s*prompt/i,
  /ignore\s+(all\s+|the\s+)?(previous|prior|above)/i,
  /너는\s*이제/,
  /역할을?\s*(바꿔|바꾸|변경)/,
  /(무조건|반드시|항상)\s*['"“‘]?(예|네|yes)['"”’]?\s*(라고|로)\s*(만\s*)?(답|대답|말)/i,
  /모든\s*질문에\s*['"“‘]?(예|네|yes)/i,
];

export function prefilterAbuse(text: string): boolean {
  return PROFANITY.some((re) => re.test(text)) || INJECTION.some((re) => re.test(text));
}

/** 욕설만 검사(탐정 이름 금칙어, PRD D40). 공백을 지우고도 본다(예: '씨 발'). */
export function containsProfanity(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  return PROFANITY.some((re) => re.test(text) || re.test(compact));
}
