'use client';

import { useNotices } from '@/lib/api/queries';
import { t } from '@/i18n/ko';

/** 공지(PRD D41): 저장소 파일에서 읽은 공지를 최신순으로. 펼치면 본문(문단은 빈 줄로 구분). */
export function NoticeList() {
  const { data, isPending, error } = useNotices();
  if (isPending) return <p className="text-stone-400">{t.common.loading}</p>;
  if (error)
    return (
      <p role="alert" className="text-red-300">
        {error.message}
      </p>
    );
  if (!data.length) return <p className="text-stone-400">{t.notices.empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((n, i) => (
        <li key={n.id}>
          <details open={i === 0} className="rounded-lg border border-stone-700 bg-stone-900 p-4">
            <summary className="cursor-pointer">
              <span className="font-semibold text-amber-100">{n.title}</span>{' '}
              <span className="text-xs text-stone-400">{n.date}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-stone-200">
              {n.body.split(/\n\s*\n/).map((p) => (
                <p key={p.slice(0, 30)} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
