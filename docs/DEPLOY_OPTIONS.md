# 배포 선택지 조사: 클라우드 AI와 호스팅

조사일 2026-11-19. 월 비용 상한 **1만 원(AI·서버 합산, PRD D46)** 안에서 배포용 클라우드 AI(D45)와 배포처(PRD §15 미정)를 고르기 위한 자료다. **아직 결정이 아니다.** AI는 평가 세트로 실측한 뒤, 배포처는 계정 개설·용량 확인 뒤 정한다. 가격은 바뀌므로 정할 때 공식 페이지를 다시 확인한다.

- 환율은 1달러 = 1,400원으로 가정했다(실제 환율에 따라 달라짐).
- 배포 절차 자체는 [DEPLOY.md](DEPLOY.md).

## 1. 우리 서비스의 AI 사용량

토큰은 AI가 글을 읽고 쓰는 단위다(한국어는 대략 1~2글자에 1토큰, 모델마다 다름). 요금은 보내는 글(입력)과 받는 글(출력)의 토큰 수로 매긴다. AI는 이전 질문을 기억하지 않아서 질문마다 사건 소개·사실 목록 전체를 다시 보낸다. 그래서 입력이 출력보다 훨씬 많다.

| 호출 | 입력 | 출력 | 근거 |
|---|---|---|---|
| 질문 판정 | 약 3,200토큰(사건 소개·사실 목록 약 3,000 + 질문) | 약 40~60토큰 | 평가 1,323회 평균 3,221 / 42, 개발 DB `ai_call` |
| 부정형 재확인 등 추가 호출 | — | — | 질문 1개당 평균 1.08회 |
| 정답 채점 | 약 2,300~3,000토큰 | 약 150~300토큰 | 개발 DB `ai_call` 평균 2,323 / 145, 최대 219 |

**사건 1판 가정**: 질문 25개, 정답 제출 1.5회(재작성 요청 포함 1.8회 호출) → 입력 약 9만 2천, 출력 약 2천 토큰.

**프롬프트 캐싱**: 같은 사건이면 사실 목록 부분이 매번 같다. 업체가 그 앞부분을 기억해 두고 싸게 계산해 준다. 아래 '캐싱' 계산은 그 부분의 80%가 캐시로 읽힌다고 가정했다. 캐시는 보통 몇 분이 지나면 사라지므로, 이용자가 적어 간격이 길면 적중률이 떨어진다.

## 2. 클라우드 AI 후보

100만 토큰당 달러, 짧은 프롬프트 기준 표준 요금.

| 후보 | 입력 | 캐시 읽기 | 출력 | 1판 비용(캐싱) | 1판 비용(캐싱 없음) | 비고 |
|---|---|---|---|---|---|---|
| Claude Haiku 5.5 | 0.10 | 0.01(캐시 쓰기 0.125) | 0.50 | 약 $0.0045 | 약 $0.010 | 공식 확인. 캐시 유효 5분, 최소 286토큰부터 캐싱 |
| GPT-5.4 nano | 0.20 | 0.02 | 1.25 | 약 $0.0088 | 약 $0.021 | 공식 확인. **지원 종료 예정(Deprecated)** 표시 → 후속 소형 모델로 비교 |
| Gemini 3.1 Flash-Lite | 0.25 | 0.025 + 보관료(100만 토큰당 시간당 $1) | 1.50 | 보관료 때문에 소규모에선 불리 | 약 $0.026 | 공식 확인. 무료 등급은 입력이 서비스 개선에 쓰일 수 있어 쓰지 않는다 |
| DeepSeek V4.1 Flash | 0.30(한산 시간 0.15) | 0.006 | 1.20 | 약 $0.010 | 약 $0.031 | 제3자 자료. 서버가 중국이라 개인정보 국외 이전 부담 → 제외 |

**비용 말고 볼 것**

- **품질**: 가격표로는 알 수 없다. 지금 평가 세트(13건)를 그대로 돌려 통과 기준(판정 90%, 정반대 0건, 인젝션 0건, 채점 95%, 지연 P95 5초)을 확인한다. 후보 하나 전체 평가는 약 1,700회 호출·입력 약 540만 토큰으로 Haiku 5.5 기준 약 $0.5~1.
- **구조화 출력(JSON 형식 강제)**: 세 업체 모두 지원한다. 세부 방식은 연결할 때 확인하고, 우리 코드는 어느 경우든 결과를 다시 검증·재시도한다.
- **개인정보**: 어느 업체든 질문 원문이 외부로 나간다. 개인정보처리방침에 AI 업체와 전송 항목을 적는다(D37, 공개 전 법규 확인).
- **구현**: 지금은 Ollama용 판정·채점기만 있다. 같은 파이프라인에 클라우드 호출부를 추가한다(D45). 캐싱이 듣도록 사건 소개·사실 목록을 프롬프트 앞부분에 고정한다.

**추천**: Claude Haiku 5.5를 1순위로, GPT 계열 소형 모델 하나를 비교 후보로 실측한다(합계 약 $1~3). Gemini Flash-Lite는 보조 후보, DeepSeek는 제외. 참고: 이 조사는 Claude(Anthropic 모델)가 했으므로 최종 선택은 실측 결과로 한다.

## 3. 배포처 후보

**필요한 것**: Next.js(standalone)·NestJS·PostgreSQL 17을 `docker-compose.prod.yml`로 한 서버에 올린다. 실행 메모리는 대략 DB 100~200MB + 백엔드 150~200MB + 프론트 150~250MB ≈ 0.5~0.7GB(추정, 실측 필요). 이미지 빌드(특히 Next)는 1.5GB 이상을 쓸 수 있어 **메모리 1GB 서버에서는 서버에서 빌드하지 않고** CI(GitHub Actions)에서 빌드한 이미지를 받아 쓰게 바꿔야 한다. 이용자가 한국이므로 서울(또는 춘천) 지역이 유리하다.

| 후보 | 월 비용 | 사양 | 장점 | 위험·단점 |
|---|---|---|---|---|
| **A. Oracle Cloud Always Free**(홈 리전 서울 또는 춘천) | **0원** | Arm(A1) 2 OCPU·12GB(한 대 또는 두 대로 나눔), 블록 스토리지 200GB, 아웃바운드 10TB, 오브젝트 스토리지 20GB | 무료, 사양 넉넉, 백업용 오브젝트 스토리지 포함 | ① **유휴 회수**: 7일간 CPU·네트워크·메모리(A1만) 사용률 95백분위가 모두 20% 미만이면 회수될 수 있다. 사용자가 적은 초기에 해당될 수 있음(사양을 작게 잡거나 유료 계정 전환이 대책으로 알려져 있으나 확인 필요). ② 인기 지역은 A1 용량 부족으로 생성이 안 될 때가 있다. ③ 무료 자원은 가입 때 정한 홈 리전에만 만든다. ④ Arm 서버라 이미지를 Arm용으로 빌드(지금 Dockerfile은 node 공식 이미지라 대체로 가능, 실측 필요) |
| **B. Vultr 서울** | 약 $5(약 7,000원) | 1GB(공유 vCPU) | 간단, 한국 지연 낮음, 시간 단위 과금 | 1GB라 빠듯함(스왑 필요, 서버 빌드 불가). 서버비만으로 예산의 70% → AI 몫이 작음. 서울 재고 확인 필요 |
| C. AWS Lightsail 서울 | $5(512MB) / 1GB는 그 이상 | — | AWS | 512MB는 부족, 1GB 이상이면 예산 초과. 서울 요금 공식 확인 필요 |
| D. 무료 서비스 나눠 쓰기(Vercel Hobby + 무료 백엔드 호스팅 + Neon 무료 DB) | 0원 | Neon 무료: 프로젝트당 1GB·월 100 CU-시간 | 서버 관리 없음 | Vercel Hobby는 **비상업 개인용만** 허용(우리 서비스 해당 여부 해석 필요). 무료 백엔드는 잠들었다 깨는 지연. DB에 사건 이미지가 버전별로 쌓여 1GB가 빠듯해질 수 있음. 지금 Docker 한 서버 구조와 달라 작업량 큼 |
| F. GCP e2-micro 무료 | 서버 0원 + 공인 IPv4 약 $3.65(≈ 5,100원) | 1GB, 공유 코어(약 0.25 vCPU), 디스크 30GB, 무료 외부 전송 월 1GB | GCP 생태계 | 무료 지역이 **미국 3곳뿐**(한국 응답 느림). CPU가 약해 세 서비스를 한 대에 올리기 빠듯함. IPv4 비용으로 실제로는 유료 |
| G. GCP 서울 e2-micro | 약 $6~44(출처마다 크게 다름, 공식 확인 필요) + IPv4 | 1GB | 한국 지역 | 싸게 잡아도 Vultr 서울과 비슷하거나 비쌈 |
| H. GCP Cloud Run + DB | Cloud Run은 무료 한도(월 200만 요청) 안, Cloud SQL 최소 약 $8~11 | 서버리스 | 서울 지역, 요청량만큼 과금 | Cloud SQL은 무료가 없어 예산 초과. 무료 외부 DB를 붙이면 콜드 스타트·구조 변경(D와 같은 문제) |
| E. Hetzner | — | — | 유럽에서 저렴 | 한국 근처는 싱가포르뿐이고 프리미엄 지역, 2026년 가격 인상 → 제외 |

GCP는 한국 이용자·월 1만 원·서버 한 대 조건에서 Oracle 무료(한국 지역, 12GB, 0원)보다 불리해 A·B 다음 대안으로 둔다. AWS의 무료 등급(신규 가입 크레딧 등)은 이번에 조사하지 않았다.

**추가 고정비**: 도메인(.com 연 1.5만 원 안팎 ≈ 월 1,300원, .kr도 비슷). HTTPS는 Caddy 등으로 무료.

## 4. 월 예산안(1만 원)

| 안 | 서버 | 도메인 | AI에 쓸 수 있는 돈 | Haiku 5.5 기준 가능한 판 수(캐싱 / 캐시가 전부 빗나갈 때) |
|---|---|---|---|---|
| **A안: Oracle 무료** | 0원 | 약 1,300원 | 약 8,700원(≈ $6.2) | 약 1,380판 / 약 490판 |
| B안: Vultr 서울 1GB | 약 7,000원 | 약 1,300원 | 약 1,700원(≈ $1.2) | 약 270판 / 약 95판 |

- 정답 채점 예비 예산(월 상한의 10%, D72)을 두면 위 판 수에서 10%가 빠진다.
- 현재 운영 설정의 AI 월 예산 `MONTHLY_AI_BUDGET_KRW`는 잠정 5,000원이다. 배포처를 정하면 위 표에 맞춰 바꾼다.

**추천**: **A안(Oracle 무료, 서울 또는 춘천 홈 리전)을 우선 시도**하고, 계정 개설·A1 용량·유휴 회수 대책에서 막히면 **B안(Vultr 서울)**으로 간다. 어느 쪽이든 CI에서 이미지를 빌드해 받아 쓰도록 배포 절차를 바꾼다(1GB 서버 대비, Arm·x86 둘 다 빌드).

## 5. 다음 단계

1. 클라우드 AI 연결 구현(Haiku 5.5 + 비교 후보 하나) → 평가 세트 실측 → 선택. → 2026-11-20 Claude 연결 구현(`LLM_PROVIDER=anthropic`, 평가 `--provider anthropic`). 실측은 API 키를 넣은 뒤. 비교 후보(GPT 계열 소형)는 키·SDK가 따로 필요해 실측 결과를 보고 정한다.
2. Oracle 계정 개설(홈 리전 선택이 중요), A1 인스턴스 생성 확인, 유휴 회수 대책 확인.
3. CI 이미지 빌드·배포 절차 정리, 메모리 실측.
4. 도메인·HTTPS·구글 로그인(OAuth 클라이언트, 운영 도메인) 준비.
5. DB 백업 정책(PRD §15 N16): Oracle이면 오브젝트 스토리지에 하루 한 번 덤프.
6. 약관·개인정보처리방침 초안(`frontend/legal/terms.md`·`privacy.md`, 2026-11-19)의 `[ ]` 자리 채우기 → 법규 확인 → 초안 안내 문구와 '초안' 판 표시 정리.
   - 시행일(두 문서 모두). 문의 이메일·보호책임자 성명은 2026-11-20에 채움. 조사 결과·남은 결정은 [LEGAL_REVIEW.md](LEGAL_REVIEW.md)
   - 호스팅 업체·데이터 위치·접속 기록 보관 기간(위 3번 결정 후)
   - AI 제공자·이전 국가·제공자 측 보관 기간(위 1번 결정 후)
   - DB 백업 보관 기간(위 5번 결정 후)
   - 운영 환경이 HTTPS인지 확인(처리방침 11항에 '모든 통신 암호화'로 적음)
   - 남은 자리는 `parseLegal` + `placeholdersIn`(frontend/src/lib/legal.ts)으로 모아 볼 수 있다.

## 출처

- AI: [Claude 가격(공식)](https://platform.claude.com/docs/en/about-claude/pricing) · [Gemini API 가격(공식)](https://aistudio.google.com/docs/pricing) · [GPT-5.4 nano(공식)](https://developers.openai.com/api/docs/models/gpt-5.4-nano) · [GPT-5.4 mini(공식)](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [OpenAI 가격 정리(spendlint)](https://spendlint.dev/pricing/openai-api) · [DeepSeek 가격(benchlm)](https://benchlm.ai/deepseek/api-pricing) · [DeepSeek 가격(costgoat)](https://costgoat.com/pricing/deepseek-api)
- 호스팅: [Oracle Always Free 자원(공식)](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) · [Oracle 무료 등급 변경 보도(mrplanb)](https://www.mrplanb.com/datacenter/free-vps-tiers) · [Vultr 서울 요금(GitHub 정리)](https://github.com/jgbdet/vultr-seoul-vps) · [Vultr 요금(costbench)](https://costbench.com/software/cloud-infrastructure/vultr/) · [Lightsail 요금(cloudburn)](https://cloudburn.io/blog/amazon-lightsail-pricing) · [Vercel Hobby 상업 이용(devtoolpick)](https://devtoolpick.com/guides/vercel-hobby-plan-commercial-use/) · [Neon 무료 한도(공식 FAQ)](https://neon.com/faqs/free-plan-limits-and-quotas) · [Hetzner 가격 조정(공식)](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) · [GCP 무료 등급 e2-micro(yangworks)](https://yangworks.dev/guides/google-cloud-free-tier-e2-micro) · [GCP 무료 등급 정리(agentdeals)](https://agentdeals.dev/gcp-free-tier-2026) · [Cloud Run 가격(공식)](https://cloud.google.com/run/pricing) · [Cloud SQL 가격(bytebase)](https://www.bytebase.com/dbcost/cloudsql-pricing/) · [e2-micro 서울 가격(devzero)](https://www.devzero.io/instances/gcp/e2-micro)
