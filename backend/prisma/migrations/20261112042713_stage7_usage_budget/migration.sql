-- CreateEnum
CREATE TYPE "UsageSubject" AS ENUM ('IP', 'PLAYER');

-- CreateTable
CREATE TABLE "usage_daily" (
    "day" DATE NOT NULL,
    "subject_type" "UsageSubject" NOT NULL,
    "subject_hash" TEXT NOT NULL,
    "questions" INTEGER NOT NULL DEFAULT 0,
    "tutorial_questions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("day","subject_type","subject_hash")
);

-- CreateTable
CREATE TABLE "budget_month" (
    "month" TEXT NOT NULL,
    "limit_krw" INTEGER NOT NULL,
    "reserve_krw" INTEGER NOT NULL,
    "spent_judge_krw" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "spent_grade_krw" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "budget_month_pkey" PRIMARY KEY ("month")
);
