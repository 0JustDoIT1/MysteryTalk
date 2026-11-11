'use client';

import { DETECTIVE_NAME_MAX } from '@mysterytalk/shared';
import { useState } from 'react';
import { useMe, useRename } from '@/lib/api/queries';
import { useSfx } from '@/lib/audio/use-sfx';
import { useDeviceHydrated, useDeviceStore } from '@/stores/device';
import { AccountBar } from '../account/AccountBar';
import { t } from '@/i18n/ko';

/** 버그 제보 외부 폼(PRD D41). 주소가 없으면 버튼을 숨긴다. */
const BUG_FORM_URL = process.env.NEXT_PUBLIC_BUG_FORM_URL ?? '';

/**
 * 설정(SPEC §12, PRD D39~D41·D64): 탐정 이름(서버), 배경음악·효과음 볼륨(기기), 계정, 버그 제보.
 * 언어 선택은 영어가 준비될 때까지 숨긴다(D64).
 */
export function SettingsView() {
  const me = useMe();
  const { bgm, sfx, setBgm, setSfx } = useDeviceStore();
  // 기기에 저장된 볼륨은 저장소 복원이 끝난 뒤에 보여 준다(서버 렌더 값과 어긋나지 않게).
  const hydrated = useDeviceHydrated();
  const play = useSfx();

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="name-heading" className="flex flex-col gap-2">
        <h2 id="name-heading" className="font-semibold text-amber-100">
          {t.settings.name}
        </h2>
        {me.data ? (
          <NameForm current={me.data.detectiveName} />
        ) : (
          <p className="text-sm text-stone-400">{t.common.loading}</p>
        )}
        <p className="text-xs text-stone-400">{t.settings.nameNote}</p>
      </section>

      <section aria-labelledby="sound-heading" className="flex flex-col gap-4">
        <h2 id="sound-heading" className="font-semibold text-amber-100">
          {t.settings.sound}
        </h2>
        {hydrated ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {t.settings.bgm} <span className="text-stone-400">{bgm}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={bgm}
                onChange={(e) => setBgm(Number(e.target.value))}
                aria-label={t.settings.bgm}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {t.settings.sfx} <span className="text-stone-400">{sfx}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={sfx}
                onChange={(e) => setSfx(Number(e.target.value))}
                onPointerUp={() => play('clue')}
                onKeyUp={() => play('clue')}
                aria-label={t.settings.sfx}
              />
            </label>
          </>
        ) : (
          <p className="text-sm text-stone-400">{t.common.loading}</p>
        )}
        <p className="text-xs text-stone-400">{t.settings.soundNote}</p>
      </section>

      <section aria-labelledby="account-heading" className="flex flex-col gap-2">
        <h2 id="account-heading" className="font-semibold text-amber-100">
          {t.settings.account}
        </h2>
        <AccountBar />
      </section>

      {BUG_FORM_URL && (
        <section aria-labelledby="bug-heading" className="flex flex-col gap-2">
          <h2 id="bug-heading" className="font-semibold text-amber-100">
            {t.settings.bug}
          </h2>
          <a
            href={BUG_FORM_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="w-fit rounded bg-stone-700 px-4 py-2 text-sm hover:bg-stone-600"
          >
            {t.settings.bugOpen}
          </a>
        </section>
      )}
    </div>
  );
}

function NameForm({ current }: { current: string }) {
  const [name, setName] = useState(current);
  const rename = useRename();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        rename.mutate(name);
      }}
    >
      <label htmlFor="detective-name" className="sr-only">
        {t.settings.nameInput}
      </label>
      <input
        id="detective-name"
        value={name}
        maxLength={DETECTIVE_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        className="rounded border border-stone-600 bg-stone-950 px-3 py-2"
      />
      <button
        type="submit"
        disabled={rename.isPending || !name.trim() || name.trim() === current}
        className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900 disabled:opacity-50"
      >
        {t.settings.save}
      </button>
      <span aria-live="polite" className="text-sm">
        {rename.isSuccess && <span className="text-emerald-300">{t.settings.saved}</span>}
        {rename.error && <span className="text-red-300">{rename.error.message}</span>}
      </span>
    </form>
  );
}
