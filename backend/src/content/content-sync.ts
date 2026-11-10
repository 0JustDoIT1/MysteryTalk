import type { PrismaClient } from '../generated/prisma/client.js';
import type { LoadedCase } from './content-files.js';

export type SyncResult = { slug: string; action: 'created' | 'new-version' | 'unchanged' };

/**
 * 검증된 사건 데이터를 DB에 반영한다(SPEC §11, PRD D59).
 * - 처음 보는 slug: 사건 + 버전 생성
 * - 버전이 올라갔으면: 새 버전 추가, 메타데이터 갱신(진행 중 세션은 다음 판정부터 새 버전 적용)
 * - 같은 버전·같은 내용: 변경 없음
 * - 같은 버전인데 내용이 다르거나 버전이 내려가면: 오류(버전을 올리라는 뜻)
 */
export async function syncCase(prisma: PrismaClient, loaded: LoadedCase): Promise<SyncResult> {
  const c = loaded.content;
  const meta = {
    isTutorial: c.isTutorial,
    title: c.title,
    summary: c.summary,
    intro: c.intro,
    caseFile: c.caseFile,
    difficulty: c.difficulty,
    baseQuestions: c.baseQuestions,
    rating: c.rating,
    tags: c.tags,
    genres: c.genres,
    explanation: c.explanation,
    currentVersion: c.version,
    isPublished: c.isPublished,
  };
  const versionData = {
    version: c.version,
    facts: c.facts,
    elements: c.elements,
    hints: c.hints,
    explore: { maps: c.maps, spawn: c.spawn, objects: c.objects, npcs: c.npcs, clues: c.clues },
    contentHash: loaded.hash,
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.mysteryCase.findUnique({
      where: { slug: c.slug },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!existing) {
      await tx.mysteryCase.create({
        data: { slug: c.slug, ...meta, versions: { create: versionData } },
      });
      return { slug: c.slug, action: 'created' };
    }
    const latest = existing.versions[0];
    if (latest && c.version < latest.version) {
      throw new Error(`${c.slug}: version ${c.version} is lower than stored ${latest.version}`);
    }
    if (latest && c.version === latest.version) {
      if (latest.contentHash !== loaded.hash) {
        throw new Error(
          `${c.slug}: content changed but version is still ${c.version}; bump "version"`,
        );
      }
      return { slug: c.slug, action: 'unchanged' };
    }
    await tx.caseVersion.create({ data: { caseId: existing.id, ...versionData } });
    await tx.mysteryCase.update({ where: { id: existing.id }, data: meta });
    return { slug: c.slug, action: 'new-version' };
  });
}
