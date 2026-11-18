'use client';

import type { MeResponse } from '@mysterytalk/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDeleteMe } from '@/lib/api/queries';
import { useDeviceStore } from '@/stores/device';
import { Modal } from '../play/Dialogs';
import { t } from '@/i18n/ko';

/**
 * 기록과 계정(PRD D95~D97): 로그인 사용자는 계정 삭제, 게스트는 이 브라우저의 기록 지우기.
 * 확인 창 한 번 뒤 즉시 영구 삭제하고 첫 화면에서 새 게스트로 시작한다.
 * 이 기기의 연령 확인 다시 하기는 기기 저장값만 지운다.
 */
export function DataSection({ me }: { me: MeResponse }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteMe();
  const resetAge = useDeviceStore((s) => s.resetAge);
  const router = useRouter();
  const user = me.kind === 'USER';

  return (
    <section aria-labelledby="data-heading" className="flex flex-col gap-3">
      <h2 id="data-heading" className="font-semibold text-amber-100">
        {t.settings.data}
      </h2>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit rounded border border-red-400/60 px-4 py-2 text-sm text-red-200 hover:bg-red-400/10"
        >
          {user ? t.settings.deleteUser : t.settings.deleteGuest}
        </button>
        <p className="text-xs text-stone-400">
          {user ? t.settings.deleteNoteUser : t.settings.deleteNoteGuest}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            resetAge();
            router.push('/');
          }}
          className="w-fit rounded bg-stone-700 px-4 py-2 text-sm hover:bg-stone-600"
        >
          {t.settings.ageReset}
        </button>
        <p className="text-xs text-stone-400">{t.settings.ageResetNote}</p>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="delete-heading">
        <h2 id="delete-heading" className="mb-3 text-lg font-semibold text-red-200">
          {user ? t.settings.deleteHeadingUser : t.settings.deleteHeadingGuest}
        </h2>
        <ul className="mb-3 flex list-disc flex-col gap-1 pl-5 text-sm text-stone-200">
          <li>{t.settings.deleteItems}</li>
          {user && <li>{t.settings.deleteItemsUser}</li>}
          <li>{t.settings.deleteAfter}</li>
        </ul>
        {del.error && (
          <p role="alert" className="mb-2 text-sm text-red-300">
            {del.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded bg-stone-700 px-4 py-2 text-sm hover:bg-stone-600"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={del.isPending}
            onClick={() =>
              del.mutate(undefined, {
                // 새 게스트로 시작하므로 화면 상태(숨겨진 채 보존된 화면 포함)를 모두 버리고 첫 화면을 새로 연다.
                // router.push는 Next가 보존한 이전 화면 상태(지운 탐정 이름 등)를 남겨서 일부러 전체 새로고침한다.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                onSuccess: () => window.location.assign('/?deleted=1'),
              })
            }
            className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {del.isPending ? t.settings.deleting : t.settings.deleteConfirm}
          </button>
        </div>
      </Modal>
    </section>
  );
}
