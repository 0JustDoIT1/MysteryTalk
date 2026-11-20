/**
 * AI 모델 단가표(SPEC §10). 1백만 토큰당 원화. 로컬 모델(Ollama)과 테스트용 판정기는 0원.
 * 배포용 클라우드 AI를 정하면 여기에 단가를 추가한다([미정], PRD §15).
 */
export type Price = { inPerMillion: number; outPerMillion: number };

const FREE: Price = { inPerMillion: 0, outPerMillion: 0 };

/** 환율 [잠정] 1달러 = 1,400원. 단가가 바뀌거나 환율이 크게 움직이면 고친다. */
const KRW_PER_USD = 1400;
const usd = (inUsd: number, outUsd: number): Price => ({
  inPerMillion: inUsd * KRW_PER_USD,
  outPerMillion: outUsd * KRW_PER_USD,
});

export const PRICES: Record<string, Price> = {
  mock: FREE,
  scripted: FREE,
  // Claude Haiku 5.5: 입력 $0.10, 출력 $0.50 / 100만 토큰(docs/DEPLOY_OPTIONS.md §2).
  // 캐시 읽기(더 쌈)도 입력 단가로 계산해 예산을 보수적으로 쓴다.
  'claude-haiku-5-5': usd(0.1, 0.5),
};

/**
 * 로컬 Ollama 모델 이름(예: gemma3:12b)은 이름에 ':'가 들어가고 0원이다.
 * 클라우드 모델이 표에 없으면 월 예산(D46)이 0원으로 계산돼 상한이 듣지 않으므로 오류로 막는다.
 */
export function priceOf(model: string): Price {
  const price = PRICES[model];
  if (price) return price;
  if (model.includes(':')) return FREE;
  throw new Error(`price unknown for model: ${model} (add it to PRICES)`);
}

export function estimateCostKrw(
  model: string,
  tokensIn: number | null,
  tokensOut: number | null,
): number {
  const p = priceOf(model);
  return ((tokensIn ?? 0) * p.inPerMillion + (tokensOut ?? 0) * p.outPerMillion) / 1_000_000;
}
