/**
 * 평가 실행 순서: 같은 질문을 연달아 묻지 않고, 회차마다 전체 항목을 섞어 한 바퀴씩 돈다.
 * 연달아 물으면 거의 항상 같은 답이 나와 실제 흔들림(실행마다 달라지는 판정)을 놓친다.
 * 같은 시드면 같은 순서라 재현할 수 있다.
 */
export function interleavedOrder(count: number, repeat: number, seed = 1): number[] {
  let state = seed >>> 0 || 1;
  const random = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order: number[] = [];
  for (let r = 0; r < repeat; r += 1) {
    const round = Array.from({ length: count }, (_, i) => i);
    for (let i = round.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [round[i], round[j]] = [round[j]!, round[i]!];
    }
    // 회차 경계에서 같은 항목이 연달아 오지 않게 한다.
    if (order.length && round.length > 1 && round[0] === order[order.length - 1]) {
      [round[0], round[1]] = [round[1]!, round[0]!];
    }
    order.push(...round);
  }
  return order;
}
