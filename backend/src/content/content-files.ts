import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  caseContentSchema,
  caseImageNames,
  IMAGE_MAX_BYTES,
  imageBytesMatch,
  imageMime,
  type CaseContent,
} from '@mysterytalk/shared';

/** 사건 이미지(PRD D92·D93): 사건 폴더 images/ 아래 파일 */
export type CaseAssetFile = { name: string; mime: string; bytes: Buffer; sha256: string };

export type LoadedCase = {
  dir: string;
  content: CaseContent;
  /** 내용 해시(이미지 포함). 같은 버전인데 해시가 다르면 적재를 거부한다 */
  hash: string;
  assets: CaseAssetFile[];
};

/**
 * 사건 데이터 폴더들(공개 `content/public` + 비공개 `CASE_DATA_DIR`)에서 `case.json`을 읽어 검증한다(SPEC §11).
 * 사건이 쓰는 이미지는 `images/`에서 읽어 형식·크기를 검사한다.
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
      const assets = readAssets(dir, caseImageNames(parsed.data));
      loaded.push({ dir, content: parsed.data, hash: contentHash(parsed.data, assets), assets });
    }
  }
  const slugs = loaded.map((c) => c.content.slug);
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dup.length) throw new Error(`duplicate case slug: ${[...new Set(dup)].join(', ')}`);
  return loaded;
}

function readAssets(dir: string, names: string[]): CaseAssetFile[] {
  const problems: string[] = [];
  const assets: CaseAssetFile[] = [];
  for (const name of names) {
    const path = join(dir, 'images', name);
    if (!existsSync(path)) {
      problems.push(`images/${name}: file not found`);
      continue;
    }
    const bytes = readFileSync(path);
    if (bytes.length > IMAGE_MAX_BYTES)
      problems.push(`images/${name}: larger than ${IMAGE_MAX_BYTES} bytes`);
    else if (!imageBytesMatch(name, bytes))
      problems.push(`images/${name}: content does not match its extension`);
    else
      assets.push({
        name,
        mime: imageMime(name),
        bytes,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
  }
  if (problems.length) throw new Error(`${dir}: invalid images\n  ${problems.join('\n  ')}`);
  return assets;
}

/**
 * 내용이 바뀌었는지 판단하는 해시(키 순서가 고정된 JSON 기준). 이미지가 있으면 이미지 해시도 섞는다
 * (이미지를 바꾸면 버전을 올려야 한다). 이미지가 없는 사건은 예전 해시와 같다.
 */
export function contentHash(content: CaseContent, assets: CaseAssetFile[] = []): string {
  const h = createHash('sha256').update(JSON.stringify(content));
  for (const a of [...assets].sort((x, y) => x.name.localeCompare(y.name)))
    h.update(`\n${a.name}:${a.sha256}`);
  return h.digest('hex');
}
