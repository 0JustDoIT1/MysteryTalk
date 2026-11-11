/**
 * 효과음(PRD D39). 효과음 파일이 정해지기 전까지 브라우저가 만드는 짧은 소리로 임시 대체한다(6단계 결정).
 * 파일이 생기면 이 모듈 안에서만 바꾼다(호출하는 쪽은 그대로).
 * 소리를 못 내는 환경(자동 재생 제한·테스트 환경 등)에서는 조용히 넘어간다.
 */
export type SfxKind =
  'YES' | 'NO' | 'MAYBE' | 'IRRELEVANT' | 'RETRY' | 'clue' | 'unlock' | 'solved' | 'wrong';

/** [주파수(Hz), 길이(초)] 음 목록 */
const TONES: Record<SfxKind, [number, number][]> = {
  YES: [
    [660, 0.08],
    [880, 0.12],
  ],
  NO: [
    [330, 0.08],
    [220, 0.14],
  ],
  MAYBE: [
    [520, 0.08],
    [520, 0.08],
  ],
  IRRELEVANT: [[400, 0.1]],
  RETRY: [
    [440, 0.06],
    [370, 0.1],
  ],
  clue: [
    [700, 0.07],
    [930, 0.07],
    [1170, 0.12],
  ],
  unlock: [
    [520, 0.08],
    [780, 0.16],
  ],
  solved: [
    [520, 0.1],
    [660, 0.1],
    [780, 0.1],
    [1040, 0.25],
  ],
  wrong: [
    [300, 0.12],
    [250, 0.2],
  ],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** volume: 0~100. 0이면 소리를 내지 않는다. */
export function playSfx(kind: SfxKind, volume: number): void {
  if (volume <= 0) return;
  const ac = context();
  if (!ac) return;
  try {
    let at = ac.currentTime;
    for (const [freq, length] of TONES[kind]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      // 귀가 아프지 않게 최대 음량을 낮게 잡고, 끝에서 부드럽게 줄인다.
      const peak = 0.08 * (volume / 100);
      gain.gain.setValueAtTime(peak, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(gain).connect(ac.destination);
      osc.start(at);
      osc.stop(at + length);
      at += length;
    }
  } catch {
    /* 소리 재생 실패는 무시 */
  }
}
