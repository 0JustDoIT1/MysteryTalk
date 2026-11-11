/**
 * 브라우저 내장 음성 인식(PRD D38, Web Speech API). 우리 서버는 음성을 받지도 저장하지도 않는다.
 * 브라우저에 따라 음성이 제조사 서버에서 처리될 수 있어 처음 쓸 때 안내한다.
 */
type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
};

export type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 이 브라우저가 음성 인식을 지원하는지(지원할 때만 마이크 버튼을 보여 준다, D63) */
export function speechSupported(): boolean {
  return ctor() !== null;
}

/** 한국어 한 문장을 인식한다. 결과 문장(앞뒤 공백 제거)을 돌려준다. */
export function createRecognition(): Recognition | null {
  const C = ctor();
  if (!C) return null;
  const r = new C();
  r.lang = 'ko-KR';
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

export function transcriptOf(e: RecognitionResultEvent): string {
  return Array.from(e.results)
    .map((alts) => alts[0]?.transcript ?? '')
    .join(' ')
    .trim();
}
