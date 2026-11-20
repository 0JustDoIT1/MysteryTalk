'use client';

import {
  DEFAULT_DETECTIVE_CHARACTER,
  DEFAULT_DETECTIVE_NAME,
  DETECTIVE_CHARACTERS,
  DETECTIVE_NAME_MAX,
  type DetectiveCharacter,
} from '@mysterytalk/shared';
import { useState } from 'react';
import { useUpdateMe } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 캐릭터 걷기 그림(3열 × 4행, 한 칸 64px)의 앞모습 서 있는 칸을 보여 준다 */
export function DetectiveSprite({ id, size = 64 }: { id: DetectiveCharacter; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block [image-rendering:pixelated]"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/sprites/detectives/${id}.png)`,
        backgroundSize: `${size * 3}px ${size * 4}px`,
        backgroundPosition: `-${size}px 0`,
      }}
    />
  );
}

/**
 * 탐정 이름·캐릭터 고르기(PRD D40·D103). '탐정 정하기' 창과 설정에서 같이 쓴다.
 * 캐릭터는 라디오 그룹이라 키보드 방향키로도 고를 수 있다. 이름·캐릭터는 AI에 전달하지 않는다.
 */
export function DetectivePicker({
  name: currentName,
  character: currentCharacter,
  submitLabel,
  onSaved,
}: {
  name: string;
  character: DetectiveCharacter | null;
  submitLabel: string;
  onSaved?: () => void;
}) {
  // 기본 이름('탐정')은 입력칸에 채우지 않고 비워 둔다. 비운 채 저장하면 이름은 그대로 둔다.
  const [name, setName] = useState(currentName === DEFAULT_DETECTIVE_NAME ? '' : currentName);
  const [character, setCharacter] = useState<DetectiveCharacter>(
    currentCharacter ?? DEFAULT_DETECTIVE_CHARACTER,
  );
  const update = useUpdateMe();
  const nameChanged = name.trim() !== '' && name.trim() !== currentName;
  const characterChanged = character !== currentCharacter;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(
          {
            ...(nameChanged ? { detectiveName: name } : {}),
            ...(characterChanged ? { detectiveCharacter: character } : {}),
          },
          { onSuccess: () => onSaved?.() },
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>{t.settings.name}</span>
        <input
          aria-label={t.settings.nameInput}
          value={name}
          maxLength={DETECTIVE_NAME_MAX}
          placeholder={t.settings.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          className="field w-full max-w-xs"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t.detective.characterLabel}</legend>
        <div className="grid max-w-sm grid-cols-2 gap-2">
          {DETECTIVE_CHARACTERS.map((id) => {
            return (
              <label
                key={id}
                className={`photo flex cursor-pointer flex-col items-center gap-1 text-center text-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold ${character === id ? 'outline-2 outline-offset-2 outline-stamp' : 'opacity-80 hover:opacity-100'}`}
              >
                <input
                  type="radio"
                  name="detective-character"
                  value={id}
                  checked={character === id}
                  onChange={() => setCharacter(id)}
                  className="sr-only"
                />
                <DetectiveSprite id={id} />
                <span className="font-serif font-bold text-ink">{t.detective.characters[id]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-xs text-ink-3">{t.settings.nameNote}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={update.isPending || (!nameChanged && !characterChanged && !onSaved)}
          className="btn btn-primary"
        >
          {submitLabel}
        </button>
        <span aria-live="polite" className="text-sm">
          {update.isSuccess && !onSaved && <span className="text-ok">{t.settings.saved}</span>}
          {update.error && <span className="text-bad">{update.error.message}</span>}
        </span>
      </div>
    </form>
  );
}
