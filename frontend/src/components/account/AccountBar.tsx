'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useConfirmAge, useLogout, useHydratedMe } from '@/lib/api/queries';
import { useDeviceStore } from '@/stores/device';
import { useToastStore } from '@/stores/toast';
import { t } from '@/i18n/ko';

/**
 * 계정 상태(PRD D29~D31): 게스트면 로그인 안내, 로그인했으면 로그아웃.
 * 로그인 직후 이 기기에서 18세 확인을 했으면 계정에도 기록한다(D33). 로그인 결과(?login=)를 알림으로 보여 준다.
 */
export function AccountBar() {
  const me = useHydratedMe();
  const logout = useLogout();
  const confirmAge = useConfirmAge();
  const age = useDeviceStore((s) => s.age);
  const pushToast = useToastStore((s) => s.push);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    const result = params.get('login');
    if (!result || handled.current) return;
    handled.current = true;
    if (result === 'ok') pushToast(t.account.loginOk);
    else if (result === 'unavailable') pushToast(t.account.loginUnavailable);
    else pushToast(t.account.loginFailed);
    router.replace(pathname, { scroll: false });
  }, [params, pathname, pushToast, router]);

  useEffect(() => {
    if (me.data?.kind === 'USER' && !me.data.ageConfirmed && age === 'yes' && confirmAge.isIdle) {
      confirmAge.mutate();
    }
  }, [me.data, age, confirmAge]);

  if (!me.data) return null;
  const user = me.data.kind === 'USER';

  return (
    <div className="paper-inset flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <p className="text-ink-2">{user ? t.account.signedIn : t.account.guest}</p>
      {user ? (
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                pushToast(t.account.loggedOut);
                router.refresh();
              },
            })
          }
          className="btn btn-ghost px-3 py-1.5 text-sm"
        >
          {t.account.logout}
        </button>
      ) : me.data.loginAvailable ? (
        // 전체 페이지 이동(구글 로그인 화면으로 갔다가 돌아온다)
        <a href="/api/auth/google" className="btn btn-primary px-3 py-1.5 text-sm">
          {t.account.login}
        </a>
      ) : (
        <span className="text-xs text-ink-3">{t.account.loginUnavailable}</span>
      )}
    </div>
  );
}
