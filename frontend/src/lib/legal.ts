/**
 * 약관·개인정보처리방침 문안(frontend/legal/*.md)을 화면용 구조로 바꾼다.
 * 문안에는 머리말(---), '## '·'### ' 제목, '- ' 목록, 빈 줄로 나눈 문단만 쓴다.
 * '[운영자 성명]'처럼 대괄호로 쓴 부분은 출시 전에 채울 자리표시로 보고 따로 표시한다.
 */
export type LegalMeta = { title: string; version: string; updated: string; effective: string };
export type LegalBlock =
  { type: 'h2' | 'h3' | 'p'; text: string } | { type: 'ul'; items: string[] };
export type LegalDoc = { meta: LegalMeta; blocks: LegalBlock[] };

export function parseLegal(source: string): LegalDoc {
  const text = source.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) throw new Error('머리말(---)이 없습니다');
  const fields = Object.fromEntries(
    m[1]!.split('\n').map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  const meta: LegalMeta = {
    title: fields.title ?? '',
    version: fields.version ?? '',
    updated: fields.updated ?? '',
    effective: fields.effective ?? '',
  };
  if (!meta.title) throw new Error('머리말에 title이 없습니다');

  const blocks: LegalBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    if (list) blocks.push({ type: 'ul', items: list });
    para = [];
    list = null;
  };
  for (const line of text.slice(m[0].length).split('\n')) {
    const s = line.trim();
    const heading = /^(#{2,3}) (.+)$/.exec(s);
    if (!s) flush();
    else if (heading) {
      flush();
      blocks.push({ type: heading[1] === '##' ? 'h2' : 'h3', text: heading[2]! });
    } else if (s.startsWith('- ')) {
      if (para.length) flush();
      (list ??= []).push(s.slice(2));
    } else {
      if (list) flush();
      para.push(s);
    }
  }
  flush();
  return { meta, blocks };
}

/** 문장을 일반 글과 자리표시('[...]')로 나눈다 */
export function splitPlaceholders(text: string): { text: string; placeholder: boolean }[] {
  return text
    .split(/(\[[^\]\n]+\])/)
    .filter(Boolean)
    .map((part) => ({ text: part, placeholder: /^\[[^\]]+\]$/.test(part) }));
}

/** 문서 전체에서 채워야 할 자리표시 목록(중복 제거) */
export function placeholdersIn(doc: LegalDoc): string[] {
  const all = [
    ...Object.values(doc.meta),
    ...doc.blocks.flatMap((b) => (b.type === 'ul' ? b.items : [b.text])),
  ];
  const found = all.flatMap((s) =>
    splitPlaceholders(s)
      .filter((p) => p.placeholder)
      .map((p) => p.text),
  );
  return [...new Set(found)];
}
