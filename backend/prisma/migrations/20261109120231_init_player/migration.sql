-- CreateEnum
CREATE TYPE "PlayerKind" AS ENUM ('GUEST', 'USER');

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "PlayerKind" NOT NULL,
    "guest_token_hash" TEXT,
    "google_sub" TEXT,
    "detective_name" TEXT NOT NULL,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "age_confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merged_into" UUID,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_guest_token_hash_key" ON "player"("guest_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "player_google_sub_key" ON "player"("google_sub");

-- CreateIndex
CREATE INDEX "player_kind_last_active_at_idx" ON "player"("kind", "last_active_at");
