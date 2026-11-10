import type { CaseFile } from '@mysterytalk/shared';
import { t } from '@/i18n/ko';

/** 수사 자료(PRD D77): 개요·관련자·확인된 타임라인. 공개 정보만 담긴다. */
export function CaseFileView({ caseFile }: { caseFile: CaseFile }) {
  return (
    <section aria-label={t.intro.caseFile} className="flex flex-col gap-4 text-sm">
      <div>
        <h3 className="mb-1 font-semibold text-amber-100">{t.intro.overview}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {caseFile.overview.map((o) => (
            <div key={o.label} className="contents">
              <dt className="text-stone-400">{o.label}</dt>
              <dd>{o.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-amber-100">{t.intro.people}</h3>
        <ul className="flex flex-col gap-1">
          {caseFile.people.map((p) => (
            <li key={p.id}>
              <span className="font-medium">{p.name}</span>{' '}
              <span className="text-stone-400">({p.role})</span> — {p.publicInfo}
            </li>
          ))}
        </ul>
      </div>
      {caseFile.timeline.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold text-amber-100">{t.intro.timeline}</h3>
          <ol className="flex flex-col gap-1">
            {caseFile.timeline.map((e) => (
              <li key={`${e.at}-${e.text}`}>
                <span className="text-stone-400">{e.at}</span> {e.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
