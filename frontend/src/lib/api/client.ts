import { ERROR_MESSAGES, errorResponseSchema, type ErrorCode } from '@mysterytalk/shared';
import type { z } from 'zod';

export type ApiErrorCode = ErrorCode | 'NETWORK' | 'INVALID_RESPONSE';

/** API 호출 결과. 실패는 서버 오류 코드 또는 네트워크·형식 오류로 구분한다. */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: ApiErrorCode; message: string };

/** TanStack Query 의 queryFn·mutationFn 에서 던지는 오류 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /** 상태를 바꾸는 요청의 멱등성 키(SPEC §5). 재시도할 때 같은 값을 보낸다. */
  idempotencyKey?: string;
};

/**
 * 같은 출처의 /api 로 요청하고 응답을 공용 zod 스키마로 검증한다.
 * 쿠키(게스트·로그인)는 같은 출처라 자동으로 실린다.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<z.infer<S>>> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  let res: Response;
  try {
    res = await fetchImpl(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      credentials: 'same-origin',
    });
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

export function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<z.infer<S>>> {
  return apiRequest(path, schema, {}, fetchImpl);
}

/** 실패하면 ApiError 를 던진다(TanStack Query 용). */
export async function apiOrThrow<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.infer<S>> {
  const result = await apiRequest(path, schema, options);
  if (!result.ok) throw new ApiError(result.code, result.status, result.message);
  return result.data;
}

/** 같은 요청으로 다시 시도해도 되는 오류(판정 지연·네트워크). 멱등성 키를 유지해 재전송한다. */
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'AI_UNAVAILABLE' || error.code === 'NETWORK');
}
