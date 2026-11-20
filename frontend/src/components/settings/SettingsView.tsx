'use client';

import Link from 'next/link';
import { useHydratedMe } from '@/lib/api/queries';
import { useSfx } from '@/lib/audio/use-sfx';
import { useDeviceHydrated, useDeviceStore } from '@/stores/device';
import { AccountBar } from '../account/AccountBar';
import { DetectivePicker } from '../account/DetectivePicker';
import { DataSection } from './DataSection';
import { t } from '@/i18n/ko';

/** 버그 제보 외부 폼(PRD D41). 주소가 없으면 버튼을 숨긴다. */
const BUG_FORM_URL = process.env.NEXT_PUBLIC_BUG_FORM_URL ?? '';

/**
 * 설정(SPEC §12, PRD D39~D41·D64·D103): 탐정 이름·캐릭터(서버), 배경음악·효과음 볼륨(기기), 계정, 버그 제보.
 * 언어 선택은 영어가 준비될 때까지 숨긴다(D64).
 */
export function SettingsView() {
  const me = useHydratedMe();
  const { bgm, sfx, setBgm, setSfx } = useDeviceStore();
  // 기기에 저장된 볼륨은 저장소 복원이 끝난 뒤에 보여 준다(서버 렌더 값과 어긋나지 않게).
  const hydrated = useDeviceHydrated();
  const play = useSfx();

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="name-heading" className="flex flex-col gap-2">
        <h2 id="name-heading" className="label">
          {t.detective.heading}
        </h2>
        {me.data ? (
          <DetectivePicker
            name={me.data.detectiveName}
            character={me.data.detectiveCharacter}
            submitLabel={t.settings.save}
          />
        ) : (
          <p className="text-sm text-ink-3">{t.common.loading}</p>
        )}
      </section>

      <section aria-labelledby="sound-heading" className="flex flex-col gap-4">
        <h2 id="sound-heading" className="label">
          {t.settings.sound}
        </h2>
        {hydrated ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {t.settings.bgm} <span className="text-ink-3">{bgm}</span>
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
                {t.settings.sfx} <span className="text-ink-3">{sfx}</span>
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
          <p className="text-sm text-ink-3">{t.common.loading}</p>
        )}
        <p className="text-xs text-ink-3">{t.settings.soundNote}</p>
      </section>

      <section aria-labelledby="account-heading" className="flex flex-col gap-2">
        <h2 id="account-heading" className="label">
          {t.settings.account}
        </h2>
        <AccountBar />
      </section>

      {me.data && <DataSection me={me.data} />}

      {BUG_FORM_URL && (
        <section aria-labelledby="bug-heading" className="flex flex-col gap-2">
          <h2 id="bug-heading" className="label">
            {t.settings.bug}
          </h2>
          <a
            href={BUG_FORM_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-secondary w-fit text-sm"
          >
            {t.settings.bugOpen}
          </a>
        </section>
      )}

      <section aria-labelledby="legal-heading" className="flex flex-col gap-2">
        <h2 id="legal-heading" className="label">
          {t.legal.heading}
        </h2>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/terms" target="_blank" className="link">
            {t.legal.terms}
          </Link>
          <Link href="/privacy" target="_blank" className="link">
            {t.legal.privacy}
          </Link>
        </p>
      </section>
    </div>
  );
}
