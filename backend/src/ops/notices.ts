import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { noticeSchema, type Notice } from '@mysterytalk/shared';

/**
 * 공지 파일 형식(PRD D41): 맨 위 머리말에 title·date, 그 아래 본문(평문, 빈 줄로 문단 구분).
 *   ---
 *   title: 제목
 *   date: 2026-11-12
 *   ---
 *   본문
 * 파일 이름(확장자 제외)이 공지 id다. 형식이 틀리면 파일 경로와 함께 실패한다(배포 전 테스트로 잡는다).
 */
export function parseNotice(id: string, text: string, file = id): Notice {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing front matter (--- title/date ---)`);
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]!] = kv[2]!.trim();
  }
  const parsed = noticeSchema.safeParse({
    id,
    title: meta['title'],
    date: meta['date'],
    body: m[2]!.trim(),
  });
  if (!parsed.success) {
    throw new Error(
      `${file}: invalid notice: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  return parsed.data;
}

/** 폴더의 공지를 최신 날짜순으로 읽는다. 폴더가 없으면 빈 목록. */
export function readNotices(dir: string): Notice[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseNotice(basename(f, '.md'), readFileSync(join(dir, f), 'utf8'), join(dir, f)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
