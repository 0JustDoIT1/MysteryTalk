# 결정 기록

이 파일은 CLAUDE.md에서 불러와 매번 읽힌다. 짧게 유지한다.
- **결정 시트**: 프로젝트의 기술·운영 결정. 정하지 못한 칸은 `미정`으로 둔다.
- **기본 부품**: 흔한 기능에 무엇을 쓰기로 했는지. 같은 종류의 요청은 조사 없이 이 표를 따른다.
- **변경 로그**: 확정되거나 바뀐 결정을 한 줄씩. 오래된 줄이 20개를 넘으면 위 표에 반영한 뒤 정리한다.
- 게임 기획 결정(D1~)은 `docs/PRD.md`에 번호로 기록한다. 이 파일에는 기술·운영 결정만 둔다.

## 결정 시트

| 분류 | 항목 | 결정 |
| --- | --- | --- |
| 플랫폼 | 대상 플랫폼·기기 | 웹(데스크톱 + 모바일 브라우저 터치), 최신 2개 버전의 크롬·엣지·사파리·파이어폭스(PRD D42·D63) |
| 플랫폼 | 개발 OS / 셸 | Windows 11 / Git Bash |
| 스택 | 언어·프레임워크 (버전까지) | Node 22, TypeScript. 프론트 Next.js 16.4(App Router) + React 19.3 + Phaser 4 + Tailwind 4. 백엔드 NestJS 12(ESM) + Prisma 7 |
| 스택 | 패키지 매니저 | npm 12 워크스페이스(shared·backend·frontend). 전역 npm 11은 쓰지 않고 `npx -y npm@12.2.2` |
| 구조 | 렌더링 방식 / 앱 구조 | 프론트는 정적·부분 미리 렌더링 + 클라이언트 컴포넌트, `/api/*`를 백엔드로 프록시. 게임 화면은 `app/(game)` 라우트 그룹 |
| 구조 | 상태관리 | 서버 상태 TanStack Query, 기기·전역 상태 Zustand(persist), URL 상태(탭·필터) |
| 구조 | API 방식 | REST(JSON), 공용 zod 스키마(`shared/`)로 요청·응답 검증, 변경 요청은 멱등성 키 |
| 구조 | 디렉터리 규칙 | `shared/`(공용 스키마), `backend/src/<도메인>/`, `frontend/src/{app,components,lib,stores,i18n}`, 사건 데이터 `content/public/`(공개)·비공개 저장소 |
| 데이터 | DB / ORM / 마이그레이션 도구 | PostgreSQL 17(Docker, 포트 5434) / Prisma 7 / `prisma migrate`(마이그레이션 파일만, db push 금지) |
| 데이터 | 시드·데이터 입력 방식 | 사건 파일(case.json) → `content:check`로 검사 → `content:load`로 적재. 내용이 바뀌면 `version`을 올린다 |
| 인증 | 방식과 권한 모델 | 게스트(쿠키 토큰 해시) + 구글 로그인(openid만). 모든 기록은 본인만 접근, 관리자 화면 없음(PRD D29~D31·D41) |
| 외부 서비스 | 사용 서비스와 월 비용 상한 | 월 1만 원 이하(AI·서버 합산, PRD D46). AI는 개발·평가 로컬 Ollama(gemma3:12b), 배포 후보 Claude Haiku 5.5(연결 구현됨, 실측 미실행). 배포처 미정. 단가표(`backend/src/ops/pricing.ts`)에 없는 클라우드 모델은 시작 시 거부 |
| 품질 | 테스트 수준 (L0~L3) | L3(단위 + API·DB 통합 + 브라우저 E2E). AI 판정·채점은 평가 세트로 따로 측정 |
| 품질 | 린터 / 포매터 | 프론트 ESLint(eslint-config-next), 백엔드 oxlint, 전체 Prettier |
| 품질 | AI 판정·채점 통과 기준 | PRD §12(판정 정확도 90%, 정반대·인젝션·부당 해결 0, 변동 3% 이하, 채점 95% 이상, P95 5초). 사건 추가·AI 교체 시 13건 재측정 |
| 품질 | 규칙 강제 | `.claude/settings.json` 권한 + Bash 가드 훅(`.claude/hooks/`) + CI `npm run guard`. PRD 편집은 확인 창 없이 대화 승인, 마이그레이션 편집·브랜치 삭제·Claude 평가는 확인 창 |
| 코드 규칙 | 에러 처리 / 로깅 / 주석 언어 | 오류 응답은 `{code, message}`로 통일, 예상 못 한 오류만 서버 로그. 질문·답안 원문·비밀값은 로그에 남기지 않는다. 주석·문서는 한국어 |
| Git | 브랜치 전략 / 커밋 형식 | main + feature/*(2026-11-20부터). `feat|fix|refactor|test|docs|chore: 요약`(한국어). 커밋은 요청·승인 후, 푸시는 사용자 |
| 배포 | 환경 구분 / CI / 배포 대상 | 개발(로컬)·운영. CI는 GitHub Actions(린트·타입·단위·통합, AI는 Mock). 배포 대상 미정(후보 Oracle 무료 등급, `docs/DEPLOY_OPTIONS.md`) |

## 기본 부품

| 용도 | 선택 | 이유 | 날짜 |
| --- | --- | --- | --- |
| 토스트·알림 | sonner 2.0.7 (`useToastStore().push`로 호출) | 자동 닫힘·쌓임·접근성(aria-live) | 2026-11-20 |
| 모달·다이얼로그 | 브라우저 `<dialog>` + `Modal` 컴포넌트(`components/play/Dialogs.tsx`) | 초점 가두기·Esc를 브라우저가 처리, 추가 의존성 없음 | 2026-11-11 |
| 폼 검증 | zod(공용 스키마 `shared/`), 서버에서 다시 검증 | 프론트·백엔드가 같은 규칙 | 2026-11-09 |
| 날짜·시간 처리 | 내장 `Date`·`Intl` | 다루는 날짜가 단순함 | 2026-11-09 |
| 아이콘 | 글자·기호(○ ✕ △ 🔒 등), 아이콘 라이브러리 없음 | 판정은 색 + 기호 + 글자로 구분(D66) | 2026-11-11 |
| HTTP 클라이언트 | 내장 fetch 감싼 `lib/api/client.ts` + TanStack Query | 응답을 zod로 검증 | 2026-11-09 |
| LLM 호출 | 공급자 무관 `LlmJudge`·`LlmGrader` + 호출부(Ollama, `@anthropic-ai/sdk`) | 공급자를 바꿔도 프롬프트·검증·재시도 공유 | 2026-11-20 |
| 글꼴 | 본문 시스템 고딕, 제목 Noto Serif KR(`next/font`로 자체 제공) | 이용자 브라우저가 외부 글꼴 서버에 요청하지 않음 | 2026-11-20 |

## 변경 로그

형식: `- YYYY-MM-DD | 결정 | 이유 | 영향 문서`

- 2026-11-25 | 변경 로그 21줄을 결정 시트·PRD·SPEC에 반영하고 정리(이전 줄은 git 기록에 있음) | 20줄 초과 규칙 | docs/decisions.md, docs/SPEC.md
