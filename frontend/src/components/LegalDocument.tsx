import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLegal, splitPlaceholders } from '@/lib/legal';
import { t } from '@/i18n/ko';

/** 문안 파일(frontend/legal)을 읽는다. 페이지는 빌드할 때 정적으로 만들어진다. */
export function readLegal(name: 'terms' | 'privacy') {
  return parseLegal(readFileSync(join(process.cwd(), 'legal', `${name}.md`), 'utf8'));
}

function Inline({ text }: { text: string }) {
  return splitPlaceholders(text).map((part, i) =>
    part.placeholder ? (
      <mark key={i} className="rounded bg-amber-300/20 px-1 text-amber-200">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

/** 약관·개인정보처리방침 본문(PRD §1). 법률 검토 전 초안임을 위에 표시한다. */
export function LegalDocument({ name }: { name: 'terms' | 'privacy' }) {
  const { meta, blocks } = readLegal(name);
  return (
    <article className="flex flex-col gap-4 text-sm leading-relaxed text-stone-200 [word-break:keep-all]">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-stone-100">{meta.title}</h1>
        <p
          role="note"
          className="rounded border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-amber-100"
        >
          {t.legal.draftNotice}
        </p>
        <p className="text-xs text-stone-400">
          {meta.version} · {t.legal.updated} {meta.updated} · {t.legal.effective}{' '}
          <Inline text={meta.effective} />
        </p>
      </header>
      {blocks.map((b, i) => {
        if (b.type === 'h2')
          return (
            <h2 key={i} className="mt-4 text-base font-semibold text-amber-100">
              {b.text}
            </h2>
          );
        if (b.type === 'h3')
          return (
            <h3 key={i} className="mt-2 font-semibold text-stone-100">
              {b.text}
            </h3>
          );
        if (b.type === 'ul')
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        );
      })}
    </article>
  );
}
