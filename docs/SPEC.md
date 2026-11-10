# MysteryTalk 구현 명세 (SPEC) v0.2

> 기준 문서: [`docs/PRD.md`](PRD.md) v1.2. PRD와 충돌하면 PRD가 우선하며, 충돌을 발견하면 수정 전에 보고한다.
> 표기: **[PRD]** PRD에서 확정된 규칙(괄호 안 D#) / **[확정]** 이 문서에서 정하고 승인된 기술·구현 선택 / **[미정]** PRD §15에 따라 나중에 정함.
> 상태: v0.2 (2026-11-09) 초안의 [제안] 항목 전체 승인(기술 선택, 상태 관리, 조작 기본값, IP 해시) → [확정]. 개발 1단계(기반) 착수.

---

## 1. 구현 원칙
- 점수·등급·해금·차감·기록은 **서버에서만 계산**한다. 클라이언트(React·Phaser)는 표시와 입력만 담당한다. [PRD §12]
- 상태를 바꾸는 모든 요청(질문, 제출, 힌트 열람, 조사, 맵 이동, 포기, 메모 저장)은 **멱등성 키**를 받아 같은 요청은 한 번만 처리하고 저장된 응답을 돌려준다.
- AI 호출은 **DB 트랜잭션 밖**에서 하고, 결과 확정만 짧은 트랜잭션으로 처리한다.
- AI 출력은 **구조화된 형식으로 강제하고 서버에서 다시 검증**한다. 허용되지 않은 값·형식은 실패로 처리한다.
- **탐정 이름·메모는 AI에 전달하지 않는다.** 사건 정답·사실 목록·미끼 여부는 공개 API로 내보내지 않는다. [PRD D40, D62]
- 오류를 삼키지 않는다. 사용자에게는 고정 문구와 코드만, 내부 사유는 서버 로그에만 남긴다(질문 원문·토큰은 로그에 남기지 않음).

---

## 2. 아키텍처

### 2.1 저장소 구성 [확정]
| 경로 | 내용 |
|---|---|
| `frontend/` | Next.js(App Router) + TypeScript. 화면, Phaser 탐색 화면(클라이언트 전용 로드) |
| `backend/` | NestJS + TypeScript. API, 판정·채점, 세션, 인증, 비용 관리 |
| `shared/` | FE·BE 공용 타입·검증 스키마(요청·응답·사건 데이터), 고정 문구 코드 |
| `content/public/` | 튜토리얼·샘플 사건 데이터(공개 저장소) [PRD D85] |
| `docs/` | PRD, SPEC, 사건 작성 규칙 |
| `docker-compose.yml` | 로컬 PostgreSQL |

- 출시용 본편 사건 데이터는 **비공개 저장소**에 두고, 배포 시 `CASE_DATA_DIR` 경로로 주입한다. 앱은 공개 사건 + 주입된 사건을 같은 형식으로 읽는다. [PRD D85]
- 패키지 관리: npm workspaces. 버전은 스캐폴딩 시점에 실제 최신 안정판을 확인해 고정한다(추정 금지).

### 2.2 기술 선택 [확정] (승인 필요)
| 영역 | 제안 | 이유 | 대안 |
|---|---|---|---|
| DB 접근·마이그레이션 | Prisma(Migrate) | 타입 안전, SQL 마이그레이션 파일 관리. `db push` 금지 | TypeORM, Drizzle |
| 요청 검증 | zod(`shared`에서 FE·BE 공용) | 같은 스키마로 요청·AI 출력·사건 데이터를 검증 | class-validator |
| 구글 로그인 | Passport(Google OAuth 2.0) + 서버 세션 쿠키 | NestJS 표준 조합, 토큰을 브라우저 JS에 노출하지 않음 | Auth.js(Next 쪽 처리) |
| 호출 제한 | @nestjs/throttler + 자체 일일 한도 테이블 | IP 단위 순간 제한은 throttler, 일일 질문 한도는 DB로 정확히 계산 | 직접 구현 |
| 맵 제작 | Tiled(JSON 내보내기) | 무료, Phaser 타일맵과 호환 | 직접 편집기 |
| 로컬 AI | Ollama | 무료·무제한 개발·평가 [PRD D45] | — |
| 테스트 | 단위·통합 Vitest(또는 생성기 기본), E2E Playwright | | Jest |
| 서버 상태(프론트) | TanStack Query | 서버 데이터 캐시·요청 후 갱신·로딩/오류 상태. 서버가 원본이라는 원칙과 맞음(§12.1) | SWR, 직접 구현 |
| 전역 상태(프론트) | Zustand | 가볍고 React 밖(Phaser)에서도 읽고 쓸 수 있어 Phaser↔React 다리에 적합(§12.1) | Redux Toolkit, Jotai, Context |

---

## 3. 식별·인증·세션

### 3.1 플레이어 식별
- 모든 플레이는 **플레이어(player)**에 속한다. 플레이어는 게스트 또는 로그인 사용자다.
- **게스트**: 첫 요청 시 32바이트 난수 토큰을 발급해 **HttpOnly·Secure·SameSite=Lax 쿠키**(`mt_guest`)로 저장한다. DB에는 SHA-256 해시만 저장한다. [PRD D29]
- **로그인**: 구글 로그인 성공 시 서버 세션 쿠키(`mt_session`)를 발급한다. 구글 계정 식별자(`sub`)로 사용자를 찾거나 만든다. [PRD D30]
- 요청 처리 순서: 로그인 세션이 있으면 사용자, 없으면 게스트 쿠키, 둘 다 없으면 새 게스트 발급.

### 3.2 게스트 → 로그인 기록 이전 [PRD D31, D82]
로그인 직후 한 트랜잭션으로:
1. 게스트의 **끝난 기록**(플레이 세션)을 모두 사용자에게 옮긴다.
2. 같은 사건의 **진행 중 세션이 양쪽에 있으면** 마지막 활동이 더 최근인 쪽을 남기고 다른 쪽은 삭제한다(F를 남기지 않음).
3. 사건별 기록(최고 등급, 달성 회차, 총 회차)을 **플레이 시작 시각 순으로 다시 계산**한다.
4. 18세 확인 기록을 계정에 저장한다(기기 확인 시각 포함). [PRD D33]
5. 게스트 플레이어는 이전 완료 표시 후 삭제(또는 비활성)한다.
- 이전 작업도 멱등이어야 한다(같은 게스트를 두 번 이전해도 결과 동일).

### 3.3 보관·삭제 [PRD D32, D37]
- 게스트: 마지막 활동 후 **30일** 지나면 플레이어와 모든 기록(질문 원문·메모 포함)을 삭제한다. 하루 1회 정리 작업.
- 로그인 사용자: 탈퇴 시 삭제. 탈퇴 절차 세부는 [미정](PRD §15).
- 통계는 비식별 집계만 남긴다. [PRD D47]

### 3.4 18세 확인 [PRD D33, D60]
- 브라우저 `localStorage`에 확인 결과(`yes`/`no`)와 시각 저장. `no`면 차단 화면만 보여 준다.
- 로그인 시 확인 여부·시각을 계정에 기록. 서버는 확인 기록이 없는 요청에도 게임 API를 막지 않는다(클라이언트 게이트, 법률 검토 전 단계). 연령 검증 수준은 [미정].

---

## 4. 데이터 모델 [확정]
모든 시각은 `timestamptz`, 기본 키는 UUID. 스키마 변경은 마이그레이션 파일로만 한다.

### 4.1 플레이어·계정
| 테이블 | 주요 필드 |
|---|---|
| `player` | id, kind(GUEST/USER), guest_token_hash UNIQUE NULL, google_sub UNIQUE NULL, detective_name, settings_json(볼륨 등), age_confirmed_at NULL, created_at, last_active_at, merged_into NULL |

### 4.2 사건 콘텐츠 (사건 데이터 파일에서 적재, §11)
| 테이블 | 주요 필드 |
|---|---|
| `case` | id, slug UNIQUE, is_tutorial, title, summary(한 줄 요약), intro(도입 이야기), case_file_json(수사 자료: 개요·관련자·타임라인), difficulty, base_questions(B), rating(NORMAL/STRONG), tags[], genres[], explanation, current_version, is_published |
| `case_version` | case_id, version, facts_json, elements_json(정답 요소·키워드), hints_json, content_hash, published_at |
| `case_map` | id, case_id, map_key, width, height, blocked_tiles_json, entrances_json(맵 간 출입구), spawn |
| `case_zone` | id, case_id, map_id, unlock_type(OPEN/CLUE/FACT), unlock_clue_id NULL, unlock_fact_id NULL, unlock_keywords_json, linked_hint_no NULL |
| `case_object` | id, case_id, map_id, object_key, x, y, description, clue_id NULL |
| `case_npc` | id, case_id, map_id, npc_key, x, y, lines_json(1~3줄), clue_id(진술 단서) |
| `clue` | id, case_id, clue_key, kind(ITEM/RECORD/TESTIMONY), title, content, is_decoy |

### 4.3 플레이
| 테이블 | 주요 필드 |
|---|---|
| `play_session` | id, player_id, case_id, case_version, play_no(회차), status(ACTIVE/SOLVED/PARTIAL/FAILED/ABANDONED), questions_used, wrong_submissions, detail_requests_used, current_map_id, pos_x, pos_y, memo, in_flight_key NULL, in_flight_until NULL, started_at, last_active_at, finished_at, score NULL, grade NULL. **부분 고유 인덱스: (player_id, case_id) WHERE status='ACTIVE'** → 사건당 진행 중 1개 [PRD D54] |
| `question_log` | id, session_id, idempotency_key, question, normalized, label(YES/NO/MAYBE/IRRELEVANT/RETRY), retry_reason NULL, fact_ids_json, counted(bool), turn_no NULL, case_version, model, latency_ms, tokens_in, tokens_out, created_at. UNIQUE(session_id, idempotency_key), UNIQUE(session_id, turn_no) |
| `submission` | id, session_id, idempotency_key, answer, result(SOLVED/WRONG/NEEDS_DETAIL), matched_json(요소별 판정), matched_count, total_count, created_at |
| `hint_view` | session_id, hint_no, viewed_at. PK(session_id, hint_no) |
| `session_clue` | session_id, clue_id, found_at. PK |
| `session_zone` | session_id, zone_id, unlocked_by(CLUE/FACT/HINT/OPEN), unlocked_at. PK |
| `case_record` | player_id, case_id, best_grade, best_score, best_play_no, total_plays, solved(bool). PK(player_id, case_id) [PRD D18] |
| `idempotency` | scope(엔드포인트), session_id 또는 player_id, key, response_json, created_at. UNIQUE(scope, owner, key) — 질문·제출 외 요청(힌트·조사·이동·포기·메모)용 |

### 4.4 비용·한도·통계
| 테이블 | 주요 필드 |
|---|---|
| `ai_call` | id, purpose(JUDGE/GRADE), session_id, model, tokens_in, tokens_out, est_cost_krw, latency_ms, ok, created_at [PRD §12 원칙] |
| `budget_month` | month(YYYY-MM), limit_krw, reserve_krw(제출 예비), spent_judge_krw, spent_grade_krw |
| `usage_daily` | day, subject_type(IP/PLAYER), subject_hash, questions, tutorial_questions. PK |
| 통계 | 별도 테이블 없이 위 테이블에서 집계 쿼리(해결률, 평균 질문 수, 힌트 사용률, '다시 질문' 비율). 개인 식별 정보 없이 사건 단위로만 출력 [PRD D47] |

---

## 5. API [확정]
모든 응답은 JSON. 오류는 `{code, message}`이며 화면 문구는 `shared`의 코드별 문구로 표시한다. 상태를 바꾸는 요청은 헤더 `Idempotency-Key: <uuid>` 필수.

| Method | Path | 설명 |
|---|---|---|
| GET | `/me` | 플레이어 정보(게스트/로그인, 탐정 이름, 설정, 18세 확인 여부) |
| PATCH | `/me` | 탐정 이름(1~12자·금칙어)·설정 변경 [D40, D39] |
| POST | `/me/age-confirmation` | 로그인 사용자의 18세 확인 기록 [D33] |
| GET | `/auth/google` · `/auth/google/callback` · POST `/auth/logout` | 구글 로그인, 콜백에서 기록 이전 실행 [D31, D82] |
| GET | `/cases` | 사건 목록: 제목, 한 줄 요약, 난이도, 수위, 태그, 장르, 상태(미해결/해결), 최고 등급·달성 회차·총 회차, 진행 중 여부 |
| GET | `/cases/{slug}` | 사건 공개 정보: 도입 이야기, 수사 자료, B, 맵 목록(공개 메타데이터만) |
| POST | `/cases/{slug}/sessions` | 새 세션 시작(진행 중이 있으면 409 `ACTIVE_SESSION_EXISTS`) |
| GET | `/sessions/{id}` | 진행 상태 전체(복원용): 진행 수치, 힌트 해금·열람, 열린 구역, 현재 맵·위치, 획득 단서, 메모, 남은 제출 기회 [D53, D76] |
| GET | `/sessions/{id}/questions` | 질문 기록(순번·질문·판정, 판정별 필터) [D48] |
| POST | `/sessions/{id}/questions` | `{question}` → 판정(§6) |
| POST | `/sessions/{id}/hints/{no}` | 힌트 열람(해금된 것만, 순서대로) [D15] |
| POST | `/sessions/{id}/move` | `{mapKey, x, y}` 맵 이동·위치 저장(구역 해금 검사) |
| POST | `/sessions/{id}/inspect` | `{objectKey 또는 npcKey}` 조사·대화 → 설명·단서·진술, 단서 해금 처리 |
| PUT | `/sessions/{id}/memo` | 메모 저장 [D62] |
| POST | `/sessions/{id}/submissions` | `{answer}` → 채점(§7) |
| POST | `/sessions/{id}/abandon` | 포기 → F, 해설 공개 [D80] |
| GET | `/sessions/{id}/ending` | 종료된 세션의 엔딩(해설, 점수 내역, 요소별 충족, 미끼·놓친 단서) [D61] |
| GET | `/notices` | 공지(저장소 파일) [D41] |

- 주요 오류 코드: `INVALID_INPUT`(422), `UNAUTHORIZED`(401), `NOT_FOUND`(404), `ACTIVE_SESSION_EXISTS`·`SESSION_FINISHED`·`SESSION_BUSY`·`QUESTION_CAP_REACHED`·`HINT_LOCKED`·`ZONE_LOCKED`(409), `DAILY_LIMIT_REACHED`·`MONTHLY_BUDGET_REACHED`·`RATE_LIMITED`(429), `AI_UNAVAILABLE`(503).
- 플레이어 소유가 아닌 세션 접근은 404로 응답한다(존재 여부 노출 방지).

---

## 6. 질문 판정 파이프라인 [PRD §5.2]

`POST /sessions/{id}/questions` 처리 순서:
1. **소유·상태 확인**: 세션 소유자, ACTIVE 여부.
2. **멱등성**: 같은 키의 기록이 있으면 저장된 응답 반환(문장이 다르면 422).
3. **입력 검증**: 유니코드 정규화(NFC), 앞뒤 공백 제거, 연속 공백 정리, 제어문자 제거 후 **2~100자** [D8]. 실패 시 422(미차감).
4. **같은 문장 재질문**: 공백·문장부호 제거 정규화 값이 같은 이전 기록이 있으면 이전 판정을 '이미 한 질문'으로 반환, 미차감 [D5].
5. **상한 확인**: questions_used ≥ 3B면 409 `QUESTION_CAP_REACHED`(제출만 가능) [D49].
6. **한도 확인**: 게스트는 IP 일일 한도, 로그인은 계정 일일 한도. 튜토리얼은 IP 한도에서 제외하고 튜토리얼 상한만 적용 [D58, D83]. 월 질문 예산 소진 시 429 [D72]. (한도 수치는 [미정])
7. **사전 필터**: 금칙어·조작 시도 패턴에 걸리면 AI 호출 없이 '다시 질문'(사유 ABUSE), 미차감 [D57].
8. **처리 중 선점**: 세션 행에 `in_flight_key`를 원자적으로 설정(다른 요청 진행 중이면 409 `SESSION_BUSY`). 만료 시간은 AI 타임아웃 합보다 길게.
9. **AI 판정**(트랜잭션 밖): 입력은 사실 목록 + 질문 1개(이전 기록·탐정 이름·메모 제외). 출력 형식 `{retryReason: COMPOUND|OPEN|ASKS_ANSWER|UNCLEAR|ABUSE|NONE, claim: string, factIds: string[], label: YES|NO|MAYBE|IRRELEVANT|RETRY}`(이 순서로 생성: '다시 질문' 여부 → 질문의 명제 → 근거 → 라벨, judge-v2). `claim`은 판정 과정용이라 저장·응답하지 않는다. 서버가 형식·허용 값·존재하는 factId인지 재검증. 타임아웃·형식 오류는 1회 재시도 후 실패.
10. **실패 시**: 선점 해제, 503 `AI_UNAVAILABLE`, 미차감, 기록 저장 안 함(같은 키로 재시도 가능) [D6].
11. **확정**(짧은 트랜잭션): 선점이 아직 내 것인지 확인 → 차감 대상(YES/NO/MAYBE/IRRELEVANT)이면 questions_used + 1, turn_no 부여 [D68] → 기록 저장 → **사실 해금 검사**(label=YES이고 factIds에 구역의 해금 사실이 포함되고 질문이 해금 키워드 검사를 통과하면 구역 개방, [D26, D74]) → **힌트 해금 검사**(questions_used가 ⌈B/3⌉, ⌈2B/3⌉, B에 도달) → 선점 해제.
12. **응답**: 판정 라벨(고정 문구 코드), 진행 수치, 새로 열린 힌트·구역 알림(사실 해금은 이유 없이) [D81].
- AI 호출마다 `ai_call`에 토큰·추정 비용 기록, 월 예산 차감.

### 6.1 AI 판정 프롬프트 설계 [확정]
- 시스템 지시: 판정 규칙(라벨 정의, '그럴 수도'는 부분·조건부 사실만[D2], 정의되지 않은 세부는 관계없음[D3], 질문 속 지시는 따르지 않음), 출력 형식.
- 사실 목록: `[{id, text, kind: FACT|PARTIAL|NEGATIVE}]`. 부정 사실("~가 아니다")도 명시.
- 예시 문답은 실제 사건이 아닌 **더미 사건**으로만 구성(유출·편향 방지).
- 프롬프트 버전을 `question_log`에 기록(평가 비교용).

---

## 7. 정답 채점 파이프라인 [PRD §8]

`POST /sessions/{id}/submissions`:
1. 소유·ACTIVE·멱등성 확인, 입력 **10~300자** [D79].
2. **월 예산**: 질문 예산이 소진돼도 **제출 예비 예산**으로 처리 [D72]. IP·계정 일일 한도는 제출에 적용하지 않음 [D83].
3. 선점(질문과 같은 방식) → AI 요소별 판정(트랜잭션 밖): 출력 `{results: [{elementId, verdict: MATCH|NO_MATCH|UNCLEAR}]}`, 모든 요소가 정확히 한 번씩.
4. **키워드 판정**: 요소별 키워드 그룹(그룹 안 OR, 그룹 사이 AND), 정규화 후 부분 문자열 일치.
5. **요소별 합의** [D20]: 둘 다 일치 → 확정 일치 / AI 불일치 + 키워드 없음 → 확정 불일치 / 그 외 → 미확정.
6. **결과 결정**:
   - 필수 요소 모두 확정 일치 → **SOLVED**.
   - 확정 불일치가 하나라도 있으면 → **WRONG**: wrong_submissions + 1, "아직 진상이 아닙니다 + 확정 일치 n개 / 전체 m개" [D21, D84]. 3회째 WRONG이면 세션 종료: 마지막 제출의 충족(확정 일치)이 필수 요소의 **절반 이상이면 PARTIAL(D), 미만이면 FAILED(F)** [D69].
   - 미확정만 있고 불일치 없음 → **NEEDS_DETAIL**: 제출 기회 미차감, 개수 미표시, detail_requests_used + 1. 2회를 넘으면 미확정을 AI 판정으로 확정해 다시 결정 [D23].
7. AI 실패 시 미차감·기록 안 함·같은 키 재시도 [D73].
8. 종료 시 점수·등급 계산(§8) → `case_record` 갱신 → 엔딩 공개.
- 정답 요소의 개수·종류는 제출 전 어떤 응답에도 포함하지 않는다 [D84].

---

## 8. 점수 계산 [PRD §8.1, 수치 잠정]
```
score = 100
      - min(40, max(0, questions_used - B) * 2)
      - hintPenalty(viewed)            // 1: 10, 2: 25, 3: 45 (누적)
      - 10 * wrong_submissions          // 해결 전 오답
grade = SOLVED  → score >= 90 ? S : >= 80 ? A : >= 70 ? B : C
        PARTIAL → D
        FAILED/ABANDONED → F
```
- 수치는 설정 파일(서버)로 분리해 플레이테스트 후 조정할 수 있게 한다.
- 튜토리얼은 점수를 계산해 보여 주되 `case_record`에 반영하지 않는다 [D24].
- 엔딩의 점수 내역은 위 항목별 감점을 그대로 보여 준다 [D61].

---

## 9. 힌트·현장 조사

### 9.1 힌트 [PRD §7]
- 해금: questions_used ≥ ⌈B/3⌉(1번), ⌈2B/3⌉(2번), B(3번). 열람은 순서대로만(앞 힌트를 안 보면 다음 힌트 열람 불가).
- 열람 시 `hint_view` 기록(PK로 중복 방지 → 이중 감점 없음). 연결된 사실 해금 구역이 있으면 함께 개방 [D26].

### 9.2 맵·구역 [PRD §6]
- 사건은 여러 맵으로 구성되고 각 맵은 하나의 구역이다 [D56]. 첫 맵은 OPEN.
- 맵 간 이동은 출입구 칸에서만 가능. 서버는 이동 요청 시 대상 맵의 구역이 열렸는지 확인(닫혀 있으면 409 `ZONE_LOCKED`).
- 위치 저장: 맵 이동 시, 조사 시, 주기적(예: 10초, 움직였을 때) [확정]. 서버는 맵 경계·막힌 칸·직전 위치 대비 이동 거리를 검증한다(완전한 치트 방지는 목표 아님).
- 조사: 플레이어와 대상이 인접(맨해튼 거리 1)해야 함. 처음 조사하면 설명 + 단서(있으면) 획득, 다시 조사하면 설명과 "이미 조사함" [확정].
- NPC: 대화하면 대사 1~3줄을 보여 주고 처음 대화 시 진술 단서 획득 [D28, D75].
- 단서 해금: 단서 획득 직후 그 단서로 열리는 구역을 개방.

### 9.3 Phaser·React 경계 [확정]
- Phaser는 이동·애니메이션·충돌·상호작용 키 입력만 처리하고 **API를 직접 호출하지 않는다**. 조사·이동 요청은 이벤트로 React에 넘기고, React가 API를 호출해 결과(모달 등)를 표시한다.
- 조작 [확정, PRD [미정] 해소]: 방향키/WASD 이동, E/Enter 조사·대화, ESC 닫기. 모바일은 가상 방향키 + 조사 버튼 [D42]. 텍스트 입력에 포커스가 있으면 Phaser 키 입력을 멈춘다.

---

## 10. 비용·한도 [PRD §11]
- 월 상한 1만 원 이하 [D46]. `budget_month.limit_krw`에서 **예비 예산(예: 10%)**을 제출 채점 전용으로 분리 [D72].
- AI 호출 전 예상 비용으로 잔액 확인, 호출 후 실제 토큰으로 정산. 모델별 단가는 설정 파일로 관리(로컬 Ollama는 0원).
- 일일 한도: `usage_daily`로 게스트는 IP 해시 단위, 로그인은 플레이어 단위로 질문 수를 센다. 튜토리얼은 별도 카운트·상한 [D58, D83]. 수치는 [미정].
- 순간 호출 제한(초·분 단위)은 throttler로 별도 적용.
- IP는 원문을 저장하지 않고 일 단위 솔트를 더한 해시만 저장 [확정].

---

## 11. 사건 데이터 형식 [확정]
사건 하나 = 디렉터리 하나: `case.json` + 맵 파일(Tiled JSON) + 평가 세트.

```
content/public/tutorial/
  case.json        # 메타·도입·수사 자료·사실 목록·정답 요소·힌트·구역·오브젝트·NPC·단서·해설
  maps/*.json      # Tiled 맵
  eval.json        # 평가 질문(30개 이상)·평가 답안
```

`case.json` 핵심 필드: `slug, isTutorial, title, summary, intro, caseFile, difficulty, baseQuestions, rating, tags, genres, version, facts[{id,text,kind}], elements[{id,description,required,keywordGroups}], hints[{no,text,linkedZone?}], maps[{key,file,unlock:{type,clue?,fact?,keywords?,hint?}}], objects[], npcs[], clues[], explanation`.

- **적재 전 검사**(콘텐츠 테스트): 형식 검증, 맵과 오브젝트·NPC 좌표 일치, 모든 맵·오브젝트에 도달 가능한지(해금 조건 포함), 단서마다 연결된 오브젝트/NPC가 정확히 1개, 사실 해금 구역은 연결된 힌트가 있음(D26 보완), 힌트 3개, 정답 요소의 필수 여부, 공개 API로 나갈 필드에 비공개 필드가 섞이지 않음.
- 버전: 내용이 바뀌면 `version`을 올리고 `case_version`에 저장, 진행 중 세션은 새 버전 적용 + 세션에 판정 당시 버전 기록 [D59].
- 작성 규칙(개연성 점검표, 표현 수위, 글쓰기)은 `docs/cases/README.md`로 따로 정리한다(사건 제작 단계에서).

---

## 12. 화면 구성 [확정]
| 화면 | 내용 |
|---|---|
| 18세 확인 | 팝업, 약관·처리방침 새 탭 링크, '아니오'면 차단 화면 [D33, D60] |
| 메인 | 배너, 새 스토리 / 이어서 / 공지 / 설정 [§2] |
| 사건 선택 | 장르 필터, 사건 카드(요약·난이도·수위·태그·상태·최고 등급·회차), 시작 버튼. 첫 방문 시 튜토리얼 권장 [D55] |
| 이어서 | 진행 중인 사건 목록 [D54] |
| 추리 화면 | 도입 이야기(첫 진입), 질문 입력(마이크 버튼은 지원 브라우저만), 판정 표시, 진행 수치, 힌트 버튼(다음 힌트까지 N개), 수첩 열기, 현장 조사, 정답 제출, 사건 메뉴(포기) |
| 수첩 | 수사 자료 / 단서(진술 포함) / 질문 기록(필터) / 메모 [D77, D48, D62] |
| 현장 조사 | Phaser 맵, 맵 전환, 조사 모달, 해금 알림, 모바일 가상 방향키 |
| 정답 제출 | 입력(10~300자), 확인 창, 결과(오답 개수·재작성 요청) |
| 엔딩 | 결과·등급, 점수 내역, 요소별 충족, 해설, 미끼·놓친 단서, 다시 하기 [D61] |
| 설정 | 탐정 이름, BGM·효과음 볼륨, 구글 로그인/로그아웃, 버그 제보(외부 폼), 언어 선택은 숨김 [D39~D41, D64] |
| 공지 | 목록·본문 [D41] |

### 12.1 프론트엔드 상태 관리 [확정]
상태를 네 종류로 나누고 종류마다 도구를 하나만 쓴다. **한 데이터는 한 곳에만 둔다.**

| 종류 | 무엇을 두나 | 도구 | 이 게임의 예 |
|---|---|---|---|
| **서버 상태** | 서버(DB)가 원본인 데이터. 프론트는 받아서 보여 주고, 바꿀 때는 요청만 보낸다 | **TanStack Query** | 사건 목록·카드 정보, 세션 진행 상태(진행 수치·힌트 해금·열린 구역·위치), 질문 기록, 단서, 메모, 엔딩, 플레이어 정보, 공지 |
| **전역 상태** | 서버에 없고, 여러 화면·컴포넌트 또는 **React와 Phaser가 함께** 써야 하는 것 | **Zustand** | 현재 모드(추리/현장 조사), 수첩 열림·탭, 알림(토스트) 대기열, Phaser↔React 신호(조사 요청·결과 표시·입력 잠금), 튜토리얼 안내 단계, 기기 설정(볼륨) |
| **지역 상태** | 한 컴포넌트 안에서만 쓰고 사라져도 되는 것 | **useState / useReducer** | 질문 입력 중인 글자, 한글 조합 중 여부, 정답 입력 창 내용, 확인 창 열림, 펼침·접힘 |
| **URL 상태** | 새로고침·뒤로 가기 후에도 같은 화면이어야 하는 것 | **Next.js 경로·쿼리** | 사건 slug, 화면(추리/조사/엔딩), 수첩 탭, 질문 기록 필터, 장르 필터 |

**경계 규칙**
1. **서버 데이터를 Zustand나 useState에 복사하지 않는다.** 화면에 필요한 값은 TanStack Query 캐시에서 읽는다(서버와 어긋난 값이 남는 것 방지, PRD §12 "서버에서만 계산").
2. 상태를 바꾸는 요청(질문·제출·힌트·조사·이동·포기·메모)은 **TanStack Query mutation으로만** 보낸다. 성공하면 응답으로 캐시를 갱신하거나 관련 쿼리를 다시 받는다. **질문·제출의 자동 재시도는 끈다.** 재시도는 사용자가 누를 때 **같은 멱등성 키**로 보낸다(멱등성 키는 요청을 시작할 때 만들어 응답을 받을 때까지 유지).
3. **Phaser는 Zustand 스토어로만 React와 통신한다.** Phaser는 스토어에 "명령"(조사 요청, 맵 이동 요청)을 넣고, React가 이를 받아 mutation을 실행한 뒤 결과를 스토어에 넣으면 Phaser가 읽는다. Phaser는 API와 TanStack Query를 직접 쓰지 않는다(§9.3).
4. 브라우저에 오래 남길 것은 **기기 단위 정보만** Zustand persist(localStorage)에 저장한다: 18세 확인 결과, 볼륨(게스트), 튜토리얼 권장 안내를 본 여부. 진행 기록·메모는 서버에 저장한다(D53).
5. URL에 있는 값은 Zustand에 다시 두지 않는다(URL이 원본).
6. 서버 컴포넌트에서 미리 받을 수 있는 공개 데이터(사건 목록, 공지)는 서버에서 받아 TanStack Query 캐시에 초기값으로 넘긴다. 세션·플레이어 데이터는 클라이언트에서 쿠키로 요청한다.

- 판정 대기 중 입력 잠금 + '수사 중…' 연출 [D87]. 판정 결과는 화면 낭독(aria-live)으로 알림, 판정 라벨은 색 + 글자·아이콘 [D66].
- 한글 입력기 조합 중 Enter는 제출하지 않는다(조합 완료 후 제출).
- 화면 문구는 번역 파일 구조로 작성(한국어만 채움) [D64].

---

## 13. 보안·개인정보
- 세션 쿠키·게스트 쿠키: HttpOnly, Secure(운영), SameSite=Lax. 토큰은 해시로 저장, 비교는 상수 시간.
- 다른 플레이어의 세션·기록 접근 불가(소유자 검사, 404 응답).
- 공개 응답 필드는 `shared` 스키마로 명시적으로 고른다(사실 목록·정답 요소·미끼 여부·해설은 종료 전 비공개).
- AI 입력에 탐정 이름·메모·다른 질문 기록을 넣지 않는다.
- 로그: 요청 ID, 세션 ID, 지연 시간, 라벨, 오류 코드만. 질문·답안 원문, 토큰, IP 원문은 남기지 않는다.
- 비밀값은 환경 변수로만(`.env`는 커밋 금지, `.env.example`에는 키 이름만).

---

## 14. 테스트 전략
| 계층 | 대상 | 실행 |
|---|---|---|
| 단위 | 입력 정규화·길이, 같은 문장 판정, 차감 규칙, 점수·등급 계산(경계값), 힌트 해금 시점(올림), 요소별 합의 규칙, D/F 판정, 키워드 매처, 사실 해금 조건, 기록 병합 규칙, 사건 데이터 검사 | CI 자동 |
| 통합(실제 DB) | 멱등성(같은 키 재전송 → 같은 응답), 동시 요청(409), 선점 만료 후 늦은 결과 폐기, AI 실패 시 미차감·재시도, 3B 상한, 일일·월 한도, 예비 예산, 힌트 연타 1회 감점, 진행 중 세션 1개 제약, 게스트→로그인 이전, 소유자 검사 | CI 자동(AI는 Mock) |
| E2E | PRD §14의 E1~E18 | Playwright, AI는 Mock(결정적 응답) |
| 콘텐츠 | §11 적재 전 검사를 모든 사건에 실행 | CI 자동(공개 사건), 비공개 사건은 배포 파이프라인 |
| AI 평가 | 사건별 `eval.json`: 판정 정확도·변동률·동의어 쌍 모순·'다시 질문' 적절성·인젝션 성공률·형식 위반률, 채점의 동의어·키워드 나열·부분 정답, 응답 시간 P50/P95 | 수동(로컬 Ollama 또는 후보 클라우드 AI). 통과 기준 [미정] |

- CI: GitHub Actions에서 push·PR마다 린트·타입 검사·단위·통합·콘텐츠 테스트 [D89].

---

## 15. 개발 단계별 완료 기준 [PRD §13]
| 단계 | 내용 | 완료 기준(실제 실행해 확인) |
|---|---|---|
| 1 기반 | 모노레포, DB·마이그레이션, 게스트 쿠키·플레이어, 공통 오류 형식, CI | CI 통과, 헬스 체크, 게스트 발급·재방문 식별 테스트 통과 |
| 2 질문 판정 | §6 파이프라인, 로컬 AI 연동, Mock AI, 튜토리얼 사건 데이터, 평가 러너 | §14 질문 관련 단위·통합 테스트 통과, 튜토리얼 평가 세트 첫 측정 결과 보고 |
| 3 제출·점수·힌트·엔딩 | §7·§8·§9.1, 사건 1건 데이터, 추리 화면·수첩·엔딩(텍스트, PC) | 튜토리얼 + 사건 1건을 처음부터 엔딩까지 플레이(E2~E8 해당 부분), **범위 재점검** |
| 4 현장 조사 | 여러 맵·구역 해금·조사·NPC·위치 저장 | 탐색 단위·통합·콘텐츠 테스트, E3 탐색 부분 |
| 5 계정 | 구글 로그인, 기록 이전, 이어하기 | E9·E10 |
| 6 모바일·부가 | 터치 조작, 마이크, 사운드, 설정 | E13~E15 |
| 7 운영 | 비용·한도, 통계, 공지 | E11·E18, 예산 시뮬레이션 테스트 |
| 8 사건 제작 | 나머지 사건(작성 → 점검 → 평가 → 플레이테스트) | 사건별 콘텐츠 테스트·평가 결과·플레이테스트 기록 |
| 9 배포 | 배포처 선택, 비공개 사건 주입, 법률 검토, 공개 | 운영 환경 E2E 스모크, 배포용 AI 평가 재실행 |

---

## 16. 이 문서에서 아직 정하지 않은 것
- (v0.2) §2.2 기술 선택·§12.1 상태 관리 승인 완료.
- (v0.2) 조작 키·위치 저장 주기·재조사 동작(§9) 승인 완료.
- PRD §15의 [미정] 항목(배포처, 배포용 AI, 품질 기준, 점수 수치, 한도 수치, 법률 검토 사항 등)은 이 문서에서 정하지 않는다.
