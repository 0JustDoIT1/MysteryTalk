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
| 외부 서비스 | 사용 서비스와 월 비용 상한 | 월 1만 원 이하(AI·서버 합산, PRD D46). AI는 개발·평가 로컬 Ollama(gemma3:12b), 배포 후보 Claude Haiku 5.5(연결 구현됨, 실측 미실행). 배포처 미정 |
| 품질 | 테스트 수준 (L0~L3) | L3(단위 + API·DB 통합 + 브라우저 E2E). AI 판정·채점은 평가 세트로 따로 측정 |
| 품질 | 린터 / 포매터 | 프론트 ESLint(eslint-config-next), 백엔드 oxlint, 전체 Prettier |
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

- 2026-11-20 | 템플릿 공통 v1.1 적용(CLAUDE.md 공통·프로젝트 구역, decisions.md, 모듈 llm·db, 명령 4개, 설정) | 작업 규칙을 템플릿 구조로 통일 | CLAUDE.md, docs/decisions.md, .claude/
- 2026-11-20 | PRD는 제안 후 승인받으면 Claude가 수정(템플릿 공통 1·8장의 예외) | PRD가 길고 결정 번호로 관리해 직접 수정이 효율적 | CLAUDE.md 프로젝트 구역
- 2026-11-20 | 브랜치 전략 main 직접 커밋 → main + feature/* | 템플릿 공통 7장 | CLAUDE.md, 결정 시트
- 2026-11-20 | 비용이 드는 작업(클라우드 AI 실측, 유료 호스팅)은 사용자가 꺼낼 때까지 미룸 | 사용자 요청 | CLAUDE.md 프로젝트 구역
- 2026-11-20 | 클라우드 AI 연결: Claude(`LLM_PROVIDER=anthropic`), 단가표에 없는 클라우드 모델은 시작 단계에서 거부 | 월 예산(D46)이 0원으로 계산되던 문제 방지 | backend/src/judge, backend/src/ops/pricing.ts, .env.example
- 2026-11-20 | AI용 상세 개요(`background`)를 화면용 짧은 개요와 분리 | 짧은 개요만 주면 판정·채점 정확도 하락(PRD D106) | docs/SPEC.md, docs/cases/README.md
- 2026-11-20 | 사건 번호 표기 'CASE 01' → '사건 01', 장식용 영어 문구 삭제 | 화면은 한국어로 통일 | frontend/src/i18n/ko.ts, docs/PRD.md(D98, v1.12)
- 2026-11-20 | 사건 카드: 난이도는 점 세 개(●○○), 사진 위에 장르 배지·해결/미해결 스티커, 수위는 '강함'일 때만 표시 | 카드 정보 정리, 색 배지가 어색함 | CaseList, CaseIntro, DifficultyDots. PRD D98 반영(v1.12)
- 2026-11-20 | 힌트는 질문 수와 상관없이 언제든 순서대로 열고, 감점(−10/−15/−20)은 그대로 | 사용자 요청 | backend sessions.service·scoring, PlayStatus. PRD D15·D17·D81 반영(v1.12)
- 2026-11-20 | 추리 화면 오른쪽 배치: 진행 막대·힌트 보기·정답 제출 → 수첩 → 질문, 판정은 도장 문구가 찍히는 효과 | 사용자 요청 | PlayScreen, PlayStatus, QuestionPanel, globals.css. PRD D99 반영(v1.12)
- 2026-11-20 | 튜토리얼 안내 띠 → 처음 사건을 열 때 '수사 안내' 팝업(실제 화면 캡처 5장, 도움말로 다시 보기), 조사 지점 점 표시 삭제, 알림 2.5초, 답변 순간 화면 가장자리 빛 | 불필요한 스크롤, 찾는 재미 | PlayGuide, PlayScreen, renderer, Toasts, frontend/public/guide/. PRD D78 반영(v1.12)
- 2026-11-20 | 화면에서 '샘플' 표시 삭제, 지하주차장의 경비원 '사건 11'·302호의 정전 '사건 12' 번호 부여, 추리 화면 머리는 로고 + 목록으로·탐정·도움말(사건명은 왼쪽 서류 위) | 내부 구분이 이용자에게 보이지 않게 | lib/play/cases.ts, PlayScreen, case.json(버전 올림), 공지
- 2026-11-20 | 알림을 sonner로 교체, 화면 테마 '책상 위의 수사 서류' | 알림이 저절로 닫히지 않던 문제, 디자인 정리 | frontend, docs/SPEC.md
- 2026-11-23 | 가드레일 기계적 강제: Bash 가드 훅(Co-Authored-By·main 직접 커밋·.env·db push·migrate reset·강제 푸시·reset --hard 차단), /refine 자동 상기 훅, ask에 PRD·마이그레이션 편집·브랜치 삭제·Claude 평가 추가, .env 셸 차단을 deny 패턴에서 훅으로 이전(process.env 오차단 해소), CI에 `npm run guard` | 문서 규칙만으로는 지켜지지 않는 항목이 있음 | .claude/settings.json, .claude/hooks/, scripts/guard.mjs, ci.yml, CLAUDE.md
