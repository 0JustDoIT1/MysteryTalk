import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  caseContentSchema,
  caseImageNames,
  IMAGE_MAX_BYTES,
  imageBytesMatch,
  imageMime,
  imageSize,
  MAP_TILE_PX,
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
      checkBackgrounds(dir, parsed.data, assets);
      checkCover(dir, parsed.data, assets);
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

/** 맵 배경(D94)은 격자 크기(칸 × 32px)의 1~3배여야 한다(화면에서 격자 크기로 줄여 그린다) */
function checkBackgrounds(dir: string, c: CaseContent, assets: CaseAssetFile[]): void {
  const problems: string[] = [];
  for (const m of c.maps) {
    if (!m.background) continue;
    const asset = assets.find((a) => a.name === m.background)!;
    const size = imageSize(asset.bytes);
    const w = m.grid[0]!.length * MAP_TILE_PX;
    const h = m.grid.length * MAP_TILE_PX;
    const ok = size && [1, 2, 3].some((k) => size.width === w * k && size.height === h * k);
    if (!ok)
      problems.push(
        `map ${m.key}: background ${m.background} is ${size ? `${size.width}x${size.height}` : 'unreadable'}, expected ${w}x${h} (or 2x, 3x)`,
      );
  }
  if (problems.length)
    throw new Error(`${dir}: invalid map backgrounds\n  ${problems.join('\n  ')}`);
}

/** 카드 대표 그림(D98)은 16:9, 가로 512~1920px(카드·소개 화면에서 16:9 칸에 채워 그린다) */
function checkCover(dir: string, c: CaseContent, assets: CaseAssetFile[]): void {
  if (!c.cover) return;
  const size = imageSize(assets.find((a) => a.name === c.cover)!.bytes);
  const ok = size && size.width * 9 === size.height * 16 && size.width >= 512 && size.width <= 1920;
  if (!ok)
    throw new Error(
      `${dir}: invalid cover\n  cover ${c.cover} is ${size ? `${size.width}x${size.height}` : 'unreadable'}, expected 16:9 between 512x288 and 1920x1080`,
    );
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
