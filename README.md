# MysteryTalk (미스터리톡)

질문으로 진실을 찾는 2D 픽셀아트 추리 웹 게임. 자유 질문에 예 / 아니오 / 그럴 수도 / 관계없음으로 답하고, 현장을 조사해 단서를 모은 뒤 진상을 제출한다.

- 요구사항: [docs/PRD.md](docs/PRD.md) · 구현 명세: [docs/SPEC.md](docs/SPEC.md)

## 구조
| 경로 | 내용 |
|---|---|
| `frontend/` | Next.js(App Router) + TypeScript. `/api/*`를 백엔드로 프록시 |
| `backend/` | NestJS(ESM) + Prisma(PostgreSQL 드라이버 어댑터) |
| `shared/` | FE·BE 공용 zod 스키마·오류 코드 |
| `content/public/` | 튜토리얼·샘플 사건 데이터(본편 사건은 비공개 저장소) |
| `docker-compose.yml` | 로컬 PostgreSQL 17(호스트 포트 기본 5434) |

## 로컬 실행 (Windows Git Bash 기준)
요구: Node 22 이상, **npm 12 이상**, Docker.

```bash
# 1) 의존성 설치 (전역 npm 이 11 이하라면 npx 로 npm 12 사용)
npx -y npm@12.2.2 install

# 2) 환경 변수 파일 (값은 직접 입력)
cp .env.example .env                           # POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / POSTGRES_PORT
cp backend/.env.example backend/.env           # DATABASE_URL, DATABASE_URL_TEST(이름이 _test 로 끝나야 함) 등
cp frontend/.env.example frontend/.env.local   # BACKEND_URL (비우면 http://localhost:4000)

# 3) DB 실행 → 마이그레이션 적용 → 개발 서버
npm run db:up
npm run migrate:deploy -w backend
npm run dev                                    # shared 감시 빌드 + backend(4000) + frontend(3000)

# 4) 확인
curl http://localhost:3000/api/health          # {"status":"ok","db":"ok"}
curl http://localhost:3000/api/me              # 게스트 발급
```

## 검사
```bash
npm run format:check
npm run lint
npm run typecheck
npm test                  # shared 빌드 + backend·frontend 단위 테스트
npm run test:e2e          # 실제 테스트 DB 필요(backend/.env 의 DATABASE_URL_TEST)
npm run build -w frontend
```
CI(GitHub Actions)는 push·PR마다 위 순서를 실행한다(`.github/workflows/ci.yml`).
