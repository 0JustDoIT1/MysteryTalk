-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'NORMAL', 'HARD');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('NORMAL', 'STRONG');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'SOLVED', 'PARTIAL', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "QuestionLabel" AS ENUM ('YES', 'NO', 'MAYBE', 'IRRELEVANT', 'RETRY');

-- CreateEnum
CREATE TYPE "RetryReason" AS ENUM ('COMPOUND', 'OPEN', 'ASKS_ANSWER', 'UNCLEAR', 'ABUSE');

-- CreateEnum
CREATE TYPE "AiPurpose" AS ENUM ('JUDGE', 'GRADE');

-- CreateTable
CREATE TABLE "mystery_case" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "is_tutorial" BOOLEAN NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "case_file_json" JSONB NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "base_questions" INTEGER NOT NULL,
    "rating" "Rating" NOT NULL,
    "tags" TEXT[],
    "genres" TEXT[],
    "explanation" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mystery_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_version" (
    "case_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "facts_json" JSONB NOT NULL,
    "elements_json" JSONB NOT NULL,
    "hints_json" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_version_pkey" PRIMARY KEY ("case_id","version")
);

-- CreateTable
CREATE TABLE "play_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "case_version" INTEGER NOT NULL,
    "play_no" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "questions_used" INTEGER NOT NULL DEFAULT 0,
    "in_flight_key" UUID,
    "in_flight_until" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "play_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "label" "QuestionLabel" NOT NULL,
    "retry_reason" "RetryReason",
    "fact_ids_json" JSONB NOT NULL DEFAULT '[]',
    "counted" BOOLEAN NOT NULL,
    "turn_no" INTEGER,
    "case_version" INTEGER NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purpose" "AiPurpose" NOT NULL,
    "session_id" UUID,
    "model" TEXT NOT NULL,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "est_cost_krw" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mystery_case_slug_key" ON "mystery_case"("slug");

-- CreateIndex
CREATE INDEX "play_session_player_id_case_id_idx" ON "play_session"("player_id", "case_id");

-- CreateIndex
CREATE INDEX "question_log_session_id_normalized_idx" ON "question_log"("session_id", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "question_log_session_id_idempotency_key_key" ON "question_log"("session_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "question_log_session_id_turn_no_key" ON "question_log"("session_id", "turn_no");

-- CreateIndex
CREATE INDEX "ai_call_created_at_idx" ON "ai_call"("created_at");

-- AddForeignKey
ALTER TABLE "case_version" ADD CONSTRAINT "case_version_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mystery_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_session" ADD CONSTRAINT "play_session_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_session" ADD CONSTRAINT "play_session_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mystery_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_log" ADD CONSTRAINT "question_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call" ADD CONSTRAINT "ai_call_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 사건당 진행 중 세션은 1개(PRD D54, SPEC §4.3). Prisma 스키마로 표현할 수 없는 부분 고유 인덱스라 직접 추가한다.
CREATE UNIQUE INDEX "play_session_one_active_per_case" ON "play_session"("player_id", "case_id") WHERE "status" = 'ACTIVE';
