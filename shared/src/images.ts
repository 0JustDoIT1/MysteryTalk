import { z } from 'zod';

/**
 * 사건 이미지(PRD D92·D93): 힌트·단서 이미지 파일. 사건 폴더의 `images/` 아래에 두고,
 * 사건 데이터에는 파일 이름만 적는다. 적재 때 DB(case_asset)에 함께 넣고,
 * 열람·획득한 세션에만 서버가 내려준다.
 */
export const IMAGE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const;

/** 장당 크기 상한 [잠정] */
export const IMAGE_MAX_BYTES = 1024 * 1024;

export const imageNameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*\.(png|jpg|jpeg|webp)$/);

/** 대체 텍스트: 화면 낭독기 전용(D92). 화면에는 보이지 않는다 */
export const altSchema = z.string().min(1).max(200);

export function imageMime(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1) as keyof typeof IMAGE_TYPES;
  return IMAGE_TYPES[ext];
}

/** 파일 앞부분(매직 바이트)이 확장자와 맞는지. 이름만 바꾼 다른 형식 파일을 막는다 */
export function imageBytesMatch(name: string, bytes: Uint8Array): boolean {
  const mime = imageMime(name);
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (mime === 'image/png') return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === 'image/jpeg') return starts([0xff, 0xd8, 0xff]);
  if (mime === 'image/webp')
    return starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8);
  return false;
}
