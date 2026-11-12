/**
 * AI 모델 단가표(SPEC §10). 1백만 토큰당 원화. 로컬 모델(Ollama)과 테스트용 판정기는 0원.
 * 배포용 클라우드 AI를 정하면 여기에 단가를 추가한다([미정], PRD §15).
 */
export type Price = { inPerMillion: number; outPerMillion: number };

const FREE: Price = { inPerMillion: 0, outPerMillion: 0 };

export const PRICES: Record<string, Price> = {
  mock: FREE,
  scripted: FREE,
};

/** 로컬 Ollama 모델 이름(예: gemma3:12b)은 이름에 ':'가 들어간다. 표에 없으면 로컬로 보고 0원. */
export function priceOf(model: string): Price {
  return PRICES[model] ?? FREE;
}

export function estimateCostKrw(
  model: string,
  tokensIn: number | null,
  tokensOut: number | null,
): number {
  const p = priceOf(model);
  return ((tokensIn ?? 0) * p.inPerMillion + (tokensOut ?? 0) * p.outPerMillion) / 1_000_000;
}
