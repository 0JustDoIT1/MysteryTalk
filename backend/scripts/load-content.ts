import 'dotenv/config';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { readCaseDirs } from '../src/content/content-files.js';
import { syncCase } from '../src/content/content-sync.js';

/**
 * 사건 데이터를 DB에 적재한다: `npm run content:load -w backend`
 * 공개 사건(content/public) + 비공개 사건(CASE_DATA_DIR, 선택). 모두 먼저 검증한 뒤 반영한다.
 */
async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');
  const roots = [resolve(import.meta.dirname, '../../content/public')];
  if (process.env['CASE_DATA_DIR']) roots.push(resolve(process.env['CASE_DATA_DIR']));

  const cases = readCaseDirs(roots);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const c of cases) {
      const r = await syncCase(prisma, c);
      console.log(`${r.action.padEnd(11)} ${r.slug} (v${c.content.version})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
