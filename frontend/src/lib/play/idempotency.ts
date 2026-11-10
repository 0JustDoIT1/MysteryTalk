export type PendingRequest = { text: string; key: string };

/**
 * 멱등성 키 선택(SPEC §12.1-2). 같은 문장을 다시 보내면(판정 지연·네트워크 오류 후 재시도) 같은 키를 쓰고,
 * 문장이 바뀌면 새 키를 만든다. 성공하거나 재시도할 수 없는 오류면 호출한 쪽이 pending 을 비운다.
 */
export function keyFor(
  pending: PendingRequest | null,
  text: string,
  newKey: () => string = () => crypto.randomUUID(),
): PendingRequest {
  return pending && pending.text === text ? pending : { text, key: newKey() };
}
