import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { cleanup } from '../src/ops/cleanup.js';

/**
 * 운영 정리: `npm run cleanup:guests -w backend` (지울 개수만 보려면 `-- --dry-run`)
 * 하루 한 번 배포처의 예약 실행(cron)으로 돌린다(7단계 결정: 외부 예약).
 */
const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const dryRun = process.argv.includes('--dry-run');
  const r = await cleanup(prisma, { dryRun });
  console.log(
    `${dryRun ? '[dry-run] ' : ''}guests=${r.guests} mergedGuests=${r.mergedGuests} expiredSessions=${r.expiredSessions} usageRows=${r.usageRows}`,
  );
} finally {
  await prisma.$disconnect();
}
