import { LABEL_TEXT, type QuestionLabel } from '@mysterytalk/shared';

/** 판정 라벨은 색만으로 구분하지 않고 기호 + 글자를 함께 쓴다(PRD D66). 도장처럼 테두리를 둘렀다. */
const STYLE: Record<QuestionLabel, { icon: string; className: string }> = {
  YES: { icon: '○', className: 'bg-ok-bg text-ok border-ok' },
  NO: { icon: '✕', className: 'bg-bad-bg text-bad border-bad' },
  MAYBE: { icon: '△', className: 'bg-warn-bg text-warn border-warn' },
  IRRELEVANT: { icon: '－', className: 'bg-neutral-bg text-ink-2 border-ink-3' },
  RETRY: { icon: '?', className: 'bg-info-bg text-info border-info' },
};

export function VerdictBadge({ label, size = 'sm' }: { label: QuestionLabel; size?: 'sm' | 'lg' }) {
  const s = STYLE[label];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border-2 font-serif font-bold ${s.className} ${size === 'lg' ? 'px-3 py-1 text-lg' : 'px-2 py-0.5 text-xs'}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {LABEL_TEXT[label]}
    </span>
  );
}
