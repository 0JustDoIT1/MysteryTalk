'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { isRetryable } from '@/lib/api/client';

let browserQueryClient: QueryClient | undefined;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // 조회는 판정 지연·네트워크 오류일 때만 한 번 더 시도한다. 상태 변경(mutation)은 자동 재시도하지 않는다.
      queries: { retry: (count, error) => count < 1 && isRetryable(error), staleTime: 5_000 },
      mutations: { retry: false },
    },
  });
}

function getQueryClient(): QueryClient {
  // 서버 렌더마다 새로 만들고, 브라우저에서는 하나를 재사용한다.
  if (typeof window === 'undefined') return makeClient();
  browserQueryClient ??= makeClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
