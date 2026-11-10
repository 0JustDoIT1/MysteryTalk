-- CreateEnum
CREATE TYPE "ZoneUnlockedBy" AS ENUM ('CLUE', 'FACT', 'HINT');

-- AlterTable
ALTER TABLE "case_version" ADD COLUMN     "explore_json" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "play_session" ADD COLUMN     "current_map" TEXT,
ADD COLUMN     "pos_saved_at" TIMESTAMPTZ,
ADD COLUMN     "pos_x" INTEGER,
ADD COLUMN     "pos_y" INTEGER;

-- CreateTable
CREATE TABLE "session_clue" (
    "session_id" UUID NOT NULL,
    "clue_key" TEXT NOT NULL,
    "found_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_clue_pkey" PRIMARY KEY ("session_id","clue_key")
);

-- CreateTable
CREATE TABLE "session_zone" (
    "session_id" UUID NOT NULL,
    "map_key" TEXT NOT NULL,
    "unlocked_by" "ZoneUnlockedBy" NOT NULL,
    "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_zone_pkey" PRIMARY KEY ("session_id","map_key")
);

-- AddForeignKey
ALTER TABLE "session_clue" ADD CONSTRAINT "session_clue_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_zone" ADD CONSTRAINT "session_zone_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
