import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { caseContentSchema, type CaseContent } from '@mysterytalk/shared';

export type LoadedCase = { dir: string; content: CaseContent; hash: string };

/**
 * 사건 데이터 폴더들(공개 `content/public` + 비공개 `CASE_DATA_DIR`)에서 `case.json`을 읽어 검증한다(SPEC §11).
 * 하나라도 형식이 틀리거나 slug가 겹치면 예외를 던져 DB를 건드리지 않게 한다.
 */
export function readCaseDirs(roots: string[]): LoadedCase[] {
  const loaded: LoadedCase[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root).sort()) {
      const dir = join(root, name);
      const file = join(dir, 'case.json');
      if (!statSync(dir).isDirectory() || !existsSync(file)) continue;
      const raw = readFileSync(file, 'utf8');
      const parsed = caseContentSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n  ');
        throw new Error(`${file}: invalid case content\n  ${issues}`);
      }
      loaded.push({ dir, content: parsed.data, hash: contentHash(parsed.data) });
    }
  }
  const slugs = loaded.map((c) => c.content.slug);
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dup.length) throw new Error(`duplicate case slug: ${[...new Set(dup)].join(', ')}`);
  return loaded;
}

/** 내용이 바뀌었는지 판단하는 해시(키 순서가 고정된 JSON 기준) */
export function contentHash(content: CaseContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
