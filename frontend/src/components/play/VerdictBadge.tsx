import { LABEL_TEXT, type QuestionLabel } from '@mysterytalk/shared';

/** 판정 라벨은 색만으로 구분하지 않고 기호 + 글자를 함께 쓴다(PRD D66). */
const STYLE: Record<QuestionLabel, { icon: string; className: string }> = {
  YES: { icon: '○', className: 'bg-emerald-900 text-emerald-100 border-emerald-500' },
  NO: { icon: '✕', className: 'bg-rose-900 text-rose-100 border-rose-500' },
  MAYBE: { icon: '△', className: 'bg-amber-900 text-amber-100 border-amber-500' },
  IRRELEVANT: { icon: '－', className: 'bg-stone-700 text-stone-100 border-stone-400' },
  RETRY: { icon: '?', className: 'bg-sky-900 text-sky-100 border-sky-500' },
};

export function VerdictBadge({ label, size = 'sm' }: { label: QuestionLabel; size?: 'sm' | 'lg' }) {
  const s = STYLE[label];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-semibold ${s.className} ${size === 'lg' ? 'px-3 py-1 text-lg' : 'px-2 py-0.5 text-xs'}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {LABEL_TEXT[label]}
    </span>
  );
}
