// 가드 훅 검사: node .claude/hooks/guard-bash.test.mjs (scripts/guard.mjs가 CI에서 함께 실행)
import assert from 'node:assert/strict';
import { check } from './guard-rules.mjs';

const onMain = () => ({ top: 'D:/Project/MysteryTalk', branch: 'main' });
const onFeature = () => ({ top: 'D:/Project/MysteryTalk', branch: 'feature/x' });
const casesOnMain = () => ({ top: 'D:/Project/MysteryTalk-cases', branch: 'main' });

const blocked = [
  ['cat .env', onFeature],
  ['cat backend/.env', onFeature],
  ['head -5 .env.local', onFeature],
  ['grep KEY "backend/.env"', onFeature],
  ['source .env && npm run dev', onFeature],
  ['npx prisma db push', onFeature],
  ['cd backend && npx prisma migrate reset --force', onFeature],
  ['git push --force origin main', onFeature],
  ['git push origin +main', onFeature],
  ['git push -f', onFeature],
  ['git reset --hard HEAD~1', onFeature],
  ['git commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"', onFeature],
  ['git commit -m "feat: x"', onMain],
  ['cd /d/Project/MysteryTalk && git add -A && git commit -m "x"', onMain],
];
const allowed = [
  ['cat .env.example', onFeature],
  ['grep -r "process.env.DATABASE_URL" backend/src', onFeature],
  ["grep -r --exclude='.env*' KEY .", onFeature],
  ['cat backend/.env.example frontend/.env.example', onFeature],
  ['git commit -m "feat: x"', onFeature],
  ['git commit -m "docs: README"', casesOnMain],
  ['git push', onFeature],
  ['git push -u origin feature/x', onFeature],
  ['npm run migrate:dev -w backend', onFeature],
  ['git status', onMain],
];

let fail = 0;
for (const [cmd, git] of blocked) {
  if (!check(cmd, 'D:/Project/MysteryTalk', git)) {
    console.error(`막혀야 하는데 통과: ${cmd}`);
    fail++;
  }
}
for (const [cmd, git] of allowed) {
  const r = check(cmd, 'D:/Project/MysteryTalk', git);
  if (r) {
    console.error(`통과해야 하는데 막힘: ${cmd} → ${r}`);
    fail++;
  }
}
assert.equal(fail, 0, `가드 검사 실패 ${fail}건`);
console.log(`가드 훅 검사 통과(${blocked.length + allowed.length}건)`);
