/**
 * AI 호출 전 사전 필터(SPEC §6-7, PRD D57·D1).
 * 욕설과 '판정 규칙을 무시·변경하라'는 명백한 조작 지시를 걸러 '다시 질문(ABUSE)'으로 처리한다.
 * judge-v4부터 확실한 모양의 복합 질문(COMPOUND)·열린 질문(OPEN)도 AI 없이 '다시 질문'으로 처리한다.
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

/** 게임·출제자를 향한 뚜렷한 비난(ABUSE에만 쓰고 탐정 이름 금칙어에는 쓰지 않는다). 사건 질문에 쓰일 만한 말은 넣지 않는다. */
const INSULT = [/멍청/, /바보야/, /꺼져(라)?[\s.!]*$/, /이딴/, /이따위/, /개떡/];

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
  // judge-v4: 평가에서 AI가 '정답 직접 요구'로 잘못 분류한 조작 지시
  /(모든|위의?|앞의?|너의?)\s*(모든\s*)?(규칙|지시문?|명령|설정)[^?]{0,8}(무시하고|무시해|무시하라|잊고|잊어)/,
  /지시문\s*(을|를)?\s*(무시|잊)/,
  /(디버그|개발자|관리자|출제자|운영자)\s*(모드|권한)/,
  /(지금부터|이제부터)\s*규칙\s*(은|는|이)?\s*없/,
];

/** 사실·정답 목록을 내놓으라는 명령(질문형이 아닐 때만). "범인이 비밀 사실을 공개했나요?" 같은 사건 질문은 통과해야 한다. */
const DUMP_TARGET =
  /(숨겨진|비밀|내부|모든|전체|전부)\s*(사실|정답|진상)|(사실|정답)\s*(목록|ID|id|아이디|원문)/;
const DUMP_VERB = /(출력|나열|공개|붙여\s*넣|보여\s*줘|보여\s*주세요|그대로\s*말해)/;
const QUESTION_ENDING =
  /(나요|까요|가요|습니까|ㅂ니까|어요|었어요|았어요|죠|니)\s*[?？]*\s*$|[?？]\s*$/;

function isDumpCommand(text: string): boolean {
  return DUMP_TARGET.test(text) && DUMP_VERB.test(text) && !QUESTION_ENDING.test(text.trim());
}

export function prefilterAbuse(text: string): boolean {
  return (
    PROFANITY.some((re) => re.test(text)) ||
    INSULT.some((re) => re.test(text)) ||
    INJECTION.some((re) => re.test(text)) ||
    isDumpCommand(text)
  );
}

/**
 * 열린 질문(judge-v4, D1): 의문사가 낱말로 쓰이면 예/아니오로 답할 수 없다.
 * '누군가·뭔가·어딘가·언젠가·어떤·몇몇'처럼 '어떤 ~'을 뜻하는 말과 '누구도·어디에도·누구나·무엇이든'은 제외한다.
 * '누가 깼는지 알았나요?'처럼 의문사가 안긴 절(~는지/~은지)에 있으면 예/아니오 질문이라 AI에 맡긴다.
 */
const OPEN_STEMS = [
  '누가',
  '누구',
  '무엇',
  '뭐',
  '뭘',
  '어디',
  '언제',
  '왜',
  '어떻게',
  '몇',
  '무슨',
];
const NOT_OPEN =
  /^(누군|뭔가|어딘|언젠|몇몇|왜냐|왜곡|왜소|어떻게든)|(도|든|나|든지|라도|인가|론가|선가|엔가)$/;
const EMBEDDED_CLAUSE = /(는지|은지|던지|인지|을지|할지|될지|한지|했는지|였는지)(\s|$|[?,？])/;
/** 의문사 바로 뒤 낱말이 '~서/~면'으로 끝나면 '누가 때려서 생겼나요?'(누군가가)처럼 예/아니오 질문이다. */
const SUBORDINATE = /(서|면|니까)$/;
/** '정답이 뭐예요?', '범인이 누구예요?'는 정답 직접 요구(ASKS_ANSWER)라 AI에 맡긴다. */
const ASKS_ANSWER = /(정답|진상|범인|답)\s*(이|은|는|가)?\s*(뭐|무엇|누구)/;

export function isOpenQuestion(text: string): boolean {
  if (EMBEDDED_CLAUSE.test(text) || ASKS_ANSWER.test(text)) return false;
  const tokens = text.split(/\s+/).map((t) => t.replace(/^[^가-힣]+|[^가-힣]+$/g, ''));
  return tokens.some(
    (t, i) =>
      OPEN_STEMS.some((s) => t.startsWith(s)) &&
      !NOT_OPEN.test(t) &&
      !SUBORDINATE.test(tokens[i + 1] ?? ''),
  );
}

/**
 * 복합 질문(judge-v4, D1): 서로 다른 명제 두 개를 한 번에 묻는 확실한 모양만 잡는다.
 * - 과거형·'있다' 연결 '~했고 / ~질렀고 / ~있고' 뒤에 서술이 이어짐("범인이 문을 열었고 사장이 봤나요?")
 * - '~고 ~도 ~나요'("수면제를 타고 보일러도 풀었나요?")
 * - '~가 범인이고 ~'("장손이 범인이고 아내가 꾸몄나요?")
 * '~고 있었나요', '~고 싶었나요'처럼 명제 하나인 모양은 걸리지 않는다.
 */
const COMPOUND = [/[가-힣]고\s+[가-힣]+도\s+[가-힣]/, /(범인|진범|공범|주범)이고\s+\S/];

/** 받침 ㅆ인 음절(했·었·졌·렀·있 등) 바로 뒤의 '고 ' */
function hasSsangSiotGo(text: string): boolean {
  for (const m of text.matchAll(/([가-힣])고\s+\S/g)) {
    if ((m[1]!.charCodeAt(0) - 0xac00) % 28 === 20) return true;
  }
  return false;
}

export function isCompoundQuestion(text: string): boolean {
  return hasSsangSiotGo(text) || COMPOUND.some((re) => re.test(text));
}

/**
 * AI 호출 전 '다시 질문' 사유를 정한다. 욕설·조작 지시(ABUSE)가 먼저, 그다음 복합·열린 질문.
 * 걸리지 않으면 null(AI 판정). 잘못 걸려도 미차감이고 다시 써 달라는 안내만 나간다(D1).
 */
export function prefilterRetry(text: string): 'ABUSE' | 'COMPOUND' | 'OPEN' | null {
  if (prefilterAbuse(text)) return 'ABUSE';
  if (isCompoundQuestion(text)) return 'COMPOUND';
  if (isOpenQuestion(text)) return 'OPEN';
  return null;
}

/** 욕설만 검사(탐정 이름 금칙어, PRD D40). 공백을 지우고도 본다(예: '씨 발'). */
export function containsProfanity(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  return PROFANITY.some((re) => re.test(text) || re.test(compact));
}
