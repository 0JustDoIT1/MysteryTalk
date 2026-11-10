-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('S', 'A', 'B', 'C', 'D', 'F');

-- CreateEnum
CREATE TYPE "SubmissionResult" AS ENUM ('SOLVED', 'WRONG', 'NEEDS_DETAIL');

-- AlterTable
ALTER TABLE "play_session" ADD COLUMN     "detail_requests_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grade" "Grade",
ADD COLUMN     "memo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "wrong_submissions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "submission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "result" "SubmissionResult" NOT NULL,
    "matched_json" JSONB NOT NULL,
    "matched_count" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "case_version" INTEGER NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_view" (
    "session_id" UUID NOT NULL,
    "hint_no" INTEGER NOT NULL,
    "viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_view_pkey" PRIMARY KEY ("session_id","hint_no")
);

-- CreateTable
CREATE TABLE "case_record" (
    "player_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "best_grade" "Grade" NOT NULL,
    "best_score" INTEGER,
    "best_play_no" INTEGER NOT NULL,
    "total_plays" INTEGER NOT NULL,
    "solved" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "case_record_pkey" PRIMARY KEY ("player_id","case_id")
);

-- CreateIndex
CREATE INDEX "submission_session_id_created_at_idx" ON "submission"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "submission_session_id_idempotency_key_key" ON "submission"("session_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_view" ADD CONSTRAINT "hint_view_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mystery_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 힌트는 1~3번만(SPEC §9.1)
ALTER TABLE "hint_view" ADD CONSTRAINT "hint_view_hint_no_check" CHECK ("hint_no" BETWEEN 1 AND 3);
