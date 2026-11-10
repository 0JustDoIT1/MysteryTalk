import { describe, expect, it } from 'vitest';
import { keyFor } from './idempotency';

describe('keyFor (멱등성 키 재사용)', () => {
  let n = 0;
  const newKey = () => `k${(n += 1)}`;

  it('같은 문장 재전송은 같은 키, 문장이 바뀌면 새 키', () => {
    const first = keyFor(null, '질문 A', newKey);
    expect(keyFor(first, '질문 A', newKey)).toBe(first);
    const second = keyFor(first, '질문 B', newKey);
    expect(second.key).not.toBe(first.key);
    expect(second.text).toBe('질문 B');
  });
});
