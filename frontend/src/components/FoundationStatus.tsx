'use client';

import { useEffect, useState } from 'react';
import { healthResponseSchema, meResponseSchema, type MeResponse } from '@mysterytalk/shared';
import { apiGet } from '@/lib/api/client';

type Status = { server: string; player: string };

/** 1단계 확인용: 서버·DB 상태와 게스트 발급 여부를 보여 준다. 사건 선택 화면은 이후 단계에서 만든다. */
export function FoundationStatus() {
  const [status, setStatus] = useState<Status>({ server: '확인 중…', player: '확인 중…' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const health = await apiGet('/health', healthResponseSchema);
      const me = await apiGet('/me', meResponseSchema);
      if (!alive) return;
      setStatus({
        server: health.ok
          ? health.data.db === 'ok'
            ? '서버 정상'
            : '데이터베이스 연결 문제'
          : health.message,
        player: me.ok ? describe(me.data) : me.message,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ul role="status" aria-live="polite" className="text-sm text-zinc-600">
      <li>{status.server}</li>
      <li>{status.player}</li>
    </ul>
  );
}

function describe(me: MeResponse): string {
  return `${me.kind === 'GUEST' ? '게스트' : '로그인'} · ${me.detectiveName}`;
}
