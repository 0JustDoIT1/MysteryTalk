'use client';

import {
  DEFAULT_DETECTIVE_CHARACTER,
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
  const [name, setName] = useState(currentName);
  const [character, setCharacter] = useState<DetectiveCharacter>(
    currentCharacter ?? DEFAULT_DETECTIVE_CHARACTER,
  );
  const update = useUpdateMe();
  const nameChanged = name.trim() !== currentName;
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
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-xs rounded border border-stone-600 bg-stone-950 px-3 py-2"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">{t.detective.characterLabel}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DETECTIVE_CHARACTERS.map((id) => {
            const c = t.detective.characters[id];
            return (
              <label
                key={id}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-center text-xs ${character === id ? 'border-amber-300 bg-stone-800' : 'border-stone-700 hover:border-stone-500'}`}
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
                <span className="font-semibold text-amber-100">{c.name}</span>
                <span className="text-stone-400">{c.desc}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-xs text-stone-400">{t.settings.nameNote}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={
            update.isPending || !name.trim() || (!nameChanged && !characterChanged && !onSaved)
          }
          className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <span aria-live="polite" className="text-sm">
          {update.isSuccess && !onSaved && (
            <span className="text-emerald-300">{t.settings.saved}</span>
          )}
          {update.error && <span className="text-red-300">{update.error.message}</span>}
        </span>
      </div>
    </form>
  );
}
