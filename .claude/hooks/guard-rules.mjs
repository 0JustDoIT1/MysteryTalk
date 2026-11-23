// PreToolUse(Bash·PowerShell) 가드. CLAUDE.md 규칙 중 '반드시 지켜야 하는 것'을 기계적으로 막는다.
// - 커밋 메시지에 Co-Authored-By 트레일러 금지
// - 공개 저장소(MysteryTalk)의 main 브랜치에서 커밋을 만드는 명령 금지
//   (commit·merge·cherry-pick·revert·am. 단 merge --ff-only와 pull은 허용: 새 커밋을 만들지 않거나 원격 동기화)
// - 비밀 파일(.env, .env.local 등)을 셸에서 다루는 명령 금지(.env.example, process.env, 제외 패턴은 허용)
// - prisma db push / migrate reset, 강제 푸시, reset --hard 금지(복합 명령 안에 숨어 있어도)
// 규칙만 담는다. 훅 진입점은 guard-bash.mjs, 검사는 guard-bash.test.mjs.
// 셸을 완전히 해석하지는 않는다. 우회를 모두 막는 장치가 아니라 실수를 막는 장치다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const MSG = {
  env: '비밀 파일(.env 계열)을 셸 명령에서 다룰 수 없습니다. 키 이름은 .env.example에서 확인하세요(CLAUDE.md 7장).',
  dbPush: 'prisma db push는 금지입니다. 마이그레이션 파일로만 스키마를 바꿉니다(docs/modules/db.md).',
  migrateReset: 'prisma migrate reset은 DB를 초기화하므로 금지입니다(CLAUDE.md 6장).',
  resetHard: 'git reset --hard는 금지입니다(CLAUDE.md 6장).',
  forcePush: '강제 푸시는 금지입니다(CLAUDE.md 6장).',
  coAuthor: '커밋 메시지에 Co-Authored-By 트레일러를 넣지 않습니다(CLAUDE.md 프로젝트 구역).',
  main: '공개 저장소의 main 브랜치에서 커밋을 만들지 않습니다. feature/* 브랜치를 만드세요(CLAUDE.md 7장).',
};

/** main에서 막는, 커밋을 만드는 git 하위 명령 */
const COMMIT_MAKING = new Set(['commit', 'merge', 'cherry-pick', 'revert', 'am']);
/** 값을 다음 토큰으로 받는 git 전역 옵션 */
const GIT_OPT_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);

/** 명령 문자열을 검사해 막아야 하면 이유를, 아니면 null을 돌려준다. */
export function check(command, cwd, gitInfo = readGit) {
  const cmd = String(command ?? '');

  if (ENV_FILE.test(envScanText(cmd))) return MSG.env;
  if (/\bprisma\s+db\s+push\b/.test(cmd)) return MSG.dbPush;
  if (/\bprisma\s+migrate\s+reset\b/.test(cmd)) return MSG.migrateReset;

  const gits = segmentsWithDir(cmd, cwd)
    .map(({ seg, dir }) => ({ ...parseGit(seg), dir }))
    .filter((g) => g.sub);

  for (const g of gits) {
    if (g.sub === 'reset' && g.args.includes('--hard')) return MSG.resetHard;
    if (g.sub === 'push' && g.args.some(isForceArg)) return MSG.forcePush;
  }

  const makers = gits.filter((g) => COMMIT_MAKING.has(g.sub) && !(g.sub === 'merge' && g.args.includes('--ff-only')));
  if (makers.length === 0) return null;
  if (/co-authored-by/i.test(cmd)) return MSG.coAuthor;
  for (const g of makers) {
    const target = g.cDir ? path.resolve(g.dir, toNative(g.cDir)) : g.dir;
    const info = gitInfo(target);
    if (info && path.basename(info.top).toLowerCase() === 'mysterytalk' && info.branch === 'main') {
      return MSG.main;
    }
  }
  return null;
}

// .env 비밀 파일 참조: 앞이 경계 문자이고, 뒤가 끝·구분 문자·glob·셸 확장 문자일 때.
// '.env.example'과 'process.env'(앞이 글자)는 걸리지 않는다. '.env.*'처럼 점 뒤 glob도 막는다.
const ENV_FILE = /(^|[\s'"=/\\<:`({,$])\.env(?:\.(?!example\b)[\w.-]+)?(?=$|[\s'"|;&)>*?[\]`{},]|\.[*?[{])/m;

/**
 * .env 검사에서 뺄 부분을 지운 문자열. 아래는 파일을 읽지 않으므로 허용한다.
 * - 커밋 메시지(-m/--message 뒤 따옴표 인자)
 * - 검색 제외 패턴(--exclude=, --exclude-dir=, --glob/-g 뒤 '!' 패턴)
 */
function envScanText(cmd) {
  return cmd
    .replace(/(?:^|\s)(?:-m|--message)(?:=|\s+)(?:"(?:[^"\\]|\\.)*"|'[^']*')/g, ' ')
    .replace(/--exclude(?:-dir)?=(?:"[^"]*"|'[^']*'|\S+)/g, ' ')
    .replace(/(?:--glob|-g)(?:=|\s+)(?:"![^"]*"|'![^']*'|!\S+)/g, ' ');
}

/** 강제 푸시 인자: --force, --force-with-lease, 묶인 짧은 옵션의 f(-f, -uf), +refspec */
function isForceArg(a) {
  return /^--force(?:-with-lease)?(?:=|$)/.test(a) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || /^\+\S/.test(a);
}

/** 따옴표를 고려해 토큰으로 나눈다(따옴표는 벗긴다). */
function tokenize(seg) {
  return (seg.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/g) ?? []).map(unquote);
}

/**
 * 조각이 git 명령이면 하위 명령과 인자를 돌려준다. 앞의 환경변수(VAR=값), env,
 * git 전역 옵션(-C 경로, -c 키=값, --no-pager 등)은 건너뛴다.
 */
function parseGit(seg) {
  const t = tokenize(seg);
  let i = 0;
  while (i < t.length && (/^\w+=/.test(t[i]) || t[i] === 'env' || t[i] === 'command')) i++;
  if (!/^git(?:\.exe)?$/.test(t[i] ?? '')) return { sub: null };
  i++;
  let cDir = null;
  while (i < t.length && t[i].startsWith('-')) {
    const opt = t[i];
    if (GIT_OPT_WITH_VALUE.has(opt)) {
      if (opt === '-C') cDir = cDir ? path.join(cDir, t[i + 1] ?? '') : (t[i + 1] ?? null);
      i += 2;
    } else {
      i++;
    }
  }
  return { sub: t[i] ?? null, args: t.slice(i + 1), cDir };
}

/** &&, ||, ;, |, 줄바꿈으로 나눈 명령 조각(앞뒤 공백 제거). 따옴표 안의 구분 문자까지 가리지는 않는다. */
function segments(cmd) {
  return cmd
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 조각마다 그 시점의 작업 폴더를 추적한다(cd 경로 반영). */
function segmentsWithDir(cmd, cwd) {
  let dir = cwd || process.cwd();
  const out = [];
  for (const seg of segments(cmd)) {
    const cd = seg.match(/^cd\s+("[^"]+"|'[^']+'|\S+)\s*$/);
    if (cd) {
      dir = path.resolve(dir, toNative(unquote(cd[1])));
      continue;
    }
    out.push({ seg, dir });
  }
  return out;
}

function unquote(s) {
  return s.replace(/^"([\s\S]*)"$|^'([\s\S]*)'$/, (_, a, b) => a ?? b);
}

/** Git Bash 경로(/d/Project)를 Windows 경로(d:/Project)로. */
function toNative(p) {
  if (process.platform === 'win32') {
    const m = p.match(/^\/([a-zA-Z])(\/.*)?$/);
    if (m) return `${m[1]}:${m[2] ?? '/'}`;
  }
  return p;
}

function readGit(dir) {
  try {
    const opts = { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], opts).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts).trim();
    return { top, branch };
  } catch {
    return null;
  }
}
