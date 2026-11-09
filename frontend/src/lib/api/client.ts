import { ERROR_MESSAGES, errorResponseSchema, type ErrorCode } from '@mysterytalk/shared';
import type { z } from 'zod';

/** API 호출 결과. 실패는 서버 오류 코드 또는 네트워크·형식 오류로 구분한다. */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      status: number;
      code: ErrorCode | 'NETWORK' | 'INVALID_RESPONSE';
      message: string;
    };

/**
 * 같은 출처의 /api 로 요청하고 응답을 공용 zod 스키마로 검증한다.
 * 쿠키(게스트·로그인)는 같은 출처라 자동으로 실린다.
 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<z.infer<S>>> {
  let res: Response;
  try {
    res = await fetchImpl(`/api${path}`, { cache: 'no-store', credentials: 'same-origin' });
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: '서버에 연결할 수 없어요.' };
  }
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = errorResponseSchema.safeParse(body);
    if (err.success) {
      return {
        ok: false,
        status: res.status,
        code: err.data.code,
        message: ERROR_MESSAGES[err.data.code],
      };
    }
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: res.status,
      code: 'INVALID_RESPONSE',
      message: '서버 응답 형식이 올바르지 않아요.',
    };
  }
  return { ok: true, status: res.status, data: parsed.data };
}
