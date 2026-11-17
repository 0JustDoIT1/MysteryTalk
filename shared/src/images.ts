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

/**
 * 이미지 가로·세로(픽셀). PNG(IHDR), JPEG(SOF), WebP(VP8·VP8L·VP8X) 머리말만 읽는다.
 * 맵 배경이 격자 크기의 정수 배인지 검사할 때 쓴다(D94). 읽지 못하면 null.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const u16be = (i: number) => (bytes[i]! << 8) | bytes[i + 1]!;
  const u16le = (i: number) => bytes[i]! | (bytes[i + 1]! << 8);
  const u24le = (i: number) => bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16);
  const u32be = (i: number) =>
    ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
  const ascii = (i: number, n: number) => String.fromCharCode(...bytes.slice(i, i + n));
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(12, 4) === 'IHDR')
    return { width: u32be(16), height: u32be(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1]!;
      const len = u16be(i + 2);
      // SOF0~SOF15(DHT C4·JPG C8·DAC CC 제외)에 크기가 있다
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { width: u16be(i + 7), height: u16be(i + 5) };
      i += 2 + len;
    }
    return null;
  }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ') return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = (k: number) => bytes[21 + k]!;
      return {
        width: 1 + (b(0) | ((b(1) & 0x3f) << 8)),
        height: 1 + ((b(1) >> 6) | (b(2) << 2) | ((b(3) & 0x0f) << 10)),
      };
    }
    if (chunk === 'VP8X') return { width: 1 + u24le(24), height: 1 + u24le(27) };
  }
  return null;
}
