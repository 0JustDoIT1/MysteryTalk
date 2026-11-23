// PreToolUse(Bash·PowerShell) 가드. CLAUDE.md 규칙 중 '반드시 지켜야 하는 것'을 기계적으로 막는다.
// - 커밋 메시지에 Co-Authored-By 트레일러 금지
// - 공개 저장소(MysteryTalk)의 main 브랜치에서 직접 커밋 금지
// - 비밀 파일(.env, .env.local 등)을 셸에서 다루는 명령 금지(.env.example, process.env는 허용)
// - prisma db push / migrate reset, 강제 푸시, reset --hard 금지(복합 명령 안에 숨어 있어도)
// 규칙만 담는다. 훅 진입점은 guard-bash.mjs, 검사는 guard-bash.test.mjs.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** 명령 문자열을 검사해 막아야 하면 이유를, 아니면 null을 돌려준다. */
export function check(command, cwd, gitInfo = readGit) {
  const cmd = String(command ?? '');

  // .env 비밀 파일: 앞이 경로 구분·공백·따옴표·= 등이고, 뒤가 끝이거나 구분 문자일 때만.
  // '.env.example'과 'process.env'(앞이 글자), '.env*'(glob 패턴)는 걸리지 않는다.
  const envFile = /(^|[\s'"=/\\<:])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"|;&)>])/m;
  if (envFile.test(cmd)) {
    return '비밀 파일(.env 계열)을 셸 명령에서 다룰 수 없습니다. 키 이름은 .env.example에서 확인하세요(CLAUDE.md 7장).';
  }

  if (/\bprisma\s+db\s+push\b/.test(cmd)) {
    return 'prisma db push는 금지입니다. 마이그레이션 파일로만 스키마를 바꿉니다(docs/modules/db.md).';
  }
  if (/\bprisma\s+migrate\s+reset\b/.test(cmd)) {
    return 'prisma migrate reset은 DB를 초기화하므로 금지입니다(CLAUDE.md 6장).';
  }
  if (/\bgit\s+reset\s+(?:\S+\s+)*--hard\b/.test(cmd)) {
    return 'git reset --hard는 금지입니다(CLAUDE.md 6장).';
  }
  for (const seg of segments(cmd)) {
    if (/^git\s+push\b/.test(seg) && /(\s--force(?:-with-lease)?\b|\s-f\b|\s\+\S)/.test(seg)) {
      return '강제 푸시는 금지입니다(CLAUDE.md 6장).';
    }
  }

  const commits = segmentsWithDir(cmd, cwd).filter((s) => /^git\s+(?:-C\s+\S+\s+)?commit\b/.test(s.seg));
  if (commits.length > 0) {
    if (/co-authored-by/i.test(cmd)) {
      return '커밋 메시지에 Co-Authored-By 트레일러를 넣지 않습니다(CLAUDE.md 프로젝트 구역).';
    }
    for (const { seg, dir } of commits) {
      const c = seg.match(/^git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
      const target = c ? path.resolve(dir, unquote(c[1])) : dir;
      const info = gitInfo(target);
      if (info && path.basename(info.top).toLowerCase() === 'mysterytalk' && info.branch === 'main') {
        return '공개 저장소의 main 브랜치에서 직접 커밋하지 않습니다. feature/* 브랜치를 만드세요(CLAUDE.md 7장).';
      }
    }
  }
  return null;
}

/** &&, ||, ;, | 로 나눈 명령 조각(앞뒤 공백 제거). 따옴표 안까지 정확히 파싱하지는 않는다. */
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
  return s.replace(/^["']|["']$/g, '');
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
