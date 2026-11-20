'use client';

import { useState } from 'react';
import { t } from '@/i18n/ko';
import { Modal } from './Dialogs';

/**
 * 수사 안내 팝업(2026-11-20): 질문하기 → 판정 읽기 → 현장 조사 → 힌트 → 정답 제출을
 * 실제 게임 화면 캡처와 함께 한 단계씩 보여 준다. 이 기기에서 처음 사건을 열 때 한 번 뜨고,
 * 추리 화면의 '도움말'로 다시 볼 수 있다. 이미지는 frontend/public/guide/step-N.png.
 */
export function PlayGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = t.guide.steps;
  const last = step === steps.length - 1;
  const current = steps[step]!;

  function close() {
    setStep(0);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} labelledBy="guide-heading">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink/70 pb-2">
          <h2 id="guide-heading" className="text-xl font-bold text-ink">
            {t.guide.title} · {current.title}
          </h2>
          <span className="text-xs font-semibold text-ink-3">
            {t.guide.stepOf(step + 1, steps.length)}
          </span>
        </div>
        <div className="photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- 고정 크기의 안내용 캡처 */}
          <img
            src={`/guide/step-${step + 1}.png`}
            alt={current.alt}
            className="aspect-[16/10] w-full bg-paper-input object-contain"
          />
        </div>
        <p className="text-sm leading-relaxed text-ink-2">{current.body}</p>
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 w-6 rounded-full ${i === step ? 'bg-accent' : 'bg-line'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-dashed border-line pt-4">
          <button type="button" onClick={close} className="btn btn-ghost text-sm">
            {t.guide.skip}
          </button>
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn btn-secondary">
                {t.guide.prev}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? close() : setStep(step + 1))}
              className="btn btn-primary"
            >
              {last ? t.guide.start : t.guide.next}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
