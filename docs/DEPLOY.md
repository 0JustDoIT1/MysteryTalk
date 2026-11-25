# 배포 안내

배포처는 **Oracle Cloud 무료 등급(홈 리전 서울, Arm 서버 한 대)**, 배포용 AI는 **Claude Haiku 5.5(잠정, 13건 평가 통과 시 확정)**로 정했다(PRD D110, 2026-11-25). 대안은 AWS Lightsail. 비교 근거는 [DEPLOY_OPTIONS.md](DEPLOY_OPTIONS.md). 이 문서는 Docker 기반 준비물과 절차를 적고, Oracle 서버 준비 절차는 배포 설정 작업 때 덧붙인다.

## 1. 구성

| 구성 요소 | 이미지·서비스 | 메모 |
|---|---|---|
| 프론트(Next.js) | `frontend/Dockerfile` (standalone 출력) | 브라우저는 같은 출처의 `/api/*`만 부르고, Next 서버가 백엔드로 넘긴다. 넘길 주소(`BACKEND_URL`)와 `NEXT_PUBLIC_*`는 **빌드할 때 고정**된다 |
| 백엔드(NestJS) | `backend/Dockerfile` | `/health`로 상태 확인(DB 연결 포함). 마이그레이션 CLI와 운영 명령(정리·통계)도 이 이미지에서 돌린다 |
| DB(PostgreSQL 17) | `docker-compose.prod.yml`의 `db` 또는 외부 서비스 | 외부에 열지 않는다(로컬 루프백에만 포트 연결) |
| HTTPS | 배포처 기본 기능 또는 리버스 프록시(Caddy 등) | 프론트 포트(기본 3000)로 넘긴다. `COOKIE_SECURE=true`는 HTTPS가 있어야 동작한다 |

비공개 본편 사건 데이터(D85)와 비밀값은 이미지에 넣지 않는다(`.dockerignore`). 사건 데이터·이미지는 적재할 때 DB(`mystery_case`·`case_version`·`case_asset`)에 들어가므로 **운영 서버에 사건 폴더가 없어도 된다.**

## 2. 처음 배포

```bash
# 0) 서버에 Docker와 docker compose 플러그인, 이 저장소(공개)를 준비
cp deploy.env.example deploy.env   # 값 채우기(아래 4절), 커밋 금지

# 1) 빌드·시작(DB → 백엔드 → 프론트 순으로 상태 확인 후 뜬다)
docker compose -f docker-compose.prod.yml --env-file deploy.env up -d --build

# 2) 마이그레이션 적용(새 마이그레이션이 있을 때마다)
docker compose -f docker-compose.prod.yml --env-file deploy.env exec backend npx prisma migrate deploy

# 3) 사건 적재(3절)
```

- 이미 적용되었거나 커밋된 마이그레이션은 고치지 않는다(CLAUDE.md). 배포 전 개발 DB에서 `npm run migrate:deploy -w backend`로 먼저 확인한다.
- 업데이트: `git pull` → 1)·2) 반복. 사건만 바꿨으면 3)만.

## 3. 사건 적재(비공개 데이터)

사건을 바꾸면 `version`을 올린다(같은 버전에 내용이 다르면 적재 거부). 적재 전 `CASE_DATA_DIR=<비공개 폴더> npm run content:check -w backend`.

**방법 A(권장): 운영자 PC에서 운영 DB로 적재**. 사건 파일이 서버에 올라가지 않는다.

```bash
# 서버의 DB 포트(127.0.0.1:5435)를 내 PC로 SSH 터널링
ssh -N -L 5435:127.0.0.1:5435 <서버>
# 다른 창에서(내 PC, 저장소 루트)
DATABASE_URL=postgresql://<사용자>:<비밀번호>@localhost:5435/<DB> \
CASE_DATA_DIR=<비공개 사건 폴더 절대 경로> npm run content:load -w backend
```

외부 DB 서비스(Neon 등)를 쓰면 터널 없이 그 주소로 바로 적재한다.

**방법 B: 서버에서 일회성으로 마운트**. 비공개 폴더를 서버에 잠시 복사해 적재하고 지운다.

```bash
docker compose -f docker-compose.prod.yml --env-file deploy.env run --rm \
  -v /tmp/cases:/cases:ro -e CASE_DATA_DIR=/cases backend npm run content:load
rm -rf /tmp/cases
```

## 4. 환경 변수

`deploy.env.example`의 값을 채운다. 로컬 개발 값(`backend/.env`)은 개발 전용이다.

| 값 | 운영 값 | 이유 |
|---|---|---|
| `POSTGRES_PASSWORD`, `DATABASE_URL` | 새 무작위 비밀번호 | 개발 값 재사용 금지 |
| `PUBLIC_BASE_URL` | 운영 도메인(HTTPS) | 구글 로그인 리디렉션 주소의 기준 |
| `COOKIE_SECURE` | `true` | HTTPS에서만 쿠키 전송 |
| `TRUST_PROXY` | 기본 `uniquelocal` | 같은 도커 네트워크의 프론트가 넘겨준 실제 IP를 믿기 위해. 배포처 구조가 다르면 바꾼다 |
| `AUTH_PROVIDER` | `google` + 클라이언트 ID·비밀값 | `fake`는 운영(`NODE_ENV=production`)에서 시작 거부 |
| `LLM_PROVIDER` | `anthropic` + `ANTHROPIC_API_KEY`(Claude Haiku 5.5, PRD D110) | 평가로 확정하기 전 시험 배포는 `mock`(실제 판정 불가)도 가능 |
| `IP_HASH_SECRET` | 새 무작위 값(16자 이상) | IP는 해시로만 저장 |
| `DAILY_LIMIT_*`, `MONTHLY_AI_BUDGET_KRW` | 잠정값(60/200/60, 5,000원) | 비용 측정 후 조정(PRD §15) |
| `DATABASE_URL_TEST`, `DATABASE_URL_BROWSER`, `CASE_DATA_DIR` | 넣지 않음 | 테스트·로컬 적재 전용 |

## 5. 주기 작업·백업

```bash
# 게스트 기록 정리(D32: 마지막 플레이 후 30일). 하루 한 번(cron 등)
docker compose -f docker-compose.prod.yml --env-file deploy.env exec backend npm run cleanup:guests
# 미리 보기: 위 명령 끝에 -- --dry-run
# 비식별 통계(D47)
docker compose -f docker-compose.prod.yml --env-file deploy.env exec backend npm run stats
```

DB 백업은 `pg_dump`를 하루 한 번 떠서 Oracle 오브젝트 스토리지(무료 20GB)에 보관한다. 보관 기간은 서버를 만든 뒤 정한다(PRD §15).

```bash
docker compose -f docker-compose.prod.yml --env-file deploy.env exec db \
  pg_dump -U mysterytalk mysterytalk | gzip > backup-$(date +%F).sql.gz
```

## 6. 배포처

Oracle Cloud 무료 등급으로 정했다(PRD D110). 서버 생성이 '용량 부족'으로 막히거나, 7일 유휴 회수(CPU·네트워크·메모리 사용률이 모두 20% 미만) 문제가 해결되지 않으면 AWS Lightsail로 바꾼다. 다른 후보와 비교한 결과는 [DEPLOY_OPTIONS.md](DEPLOY_OPTIONS.md).

## 7. 출시 전 확인

- [ ] Claude Haiku 5.5로 13건 평가 실측 후 배포용 AI 확정(PRD D110, 비용 약 700~1,400원, 실행 전 승인). 운영 서버에는 GPU가 없어 Ollama를 쓸 수 없다
- [ ] 구글 OAuth 클라이언트 등록(리디렉션 URI = `PUBLIC_BASE_URL` + `/api/auth/google/callback`)
- [ ] HTTPS, `COOKIE_SECURE=true`, 실제 클라이언트 IP가 한도 집계에 잡히는지
- [ ] 마이그레이션 적용, 사건 13건 적재, `/health` 정상
- [ ] 백업·정리 주기 작업
- [ ] 약관·개인정보처리방침(외부 AI로 질문·답안 전송 고지 포함), 연령 확인, 등급분류(법규 확인)
