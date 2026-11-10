import { interleavedOrder } from './schedule.js';

describe('interleavedOrder (평가 실행 순서)', () => {
  it('항목마다 정확히 repeat 번, 회차마다 한 바퀴씩 돈다', () => {
    const order = interleavedOrder(5, 3, 7);
    expect(order).toHaveLength(15);
    for (let r = 0; r < 3; r += 1) {
      expect(order.slice(r * 5, r * 5 + 5).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('같은 항목을 연달아 묻지 않고, 같은 시드면 같은 순서다', () => {
    for (const seed of [1, 2, 3, 42]) {
      const order = interleavedOrder(4, 5, seed);
      expect(order.every((v, i) => i === 0 || v !== order[i - 1])).toBe(true);
      expect(interleavedOrder(4, 5, seed)).toEqual(order);
    }
  });
});
