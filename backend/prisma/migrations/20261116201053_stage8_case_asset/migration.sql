-- CreateTable
CREATE TABLE "case_asset" (
    "case_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,

    CONSTRAINT "case_asset_pkey" PRIMARY KEY ("case_id","version","name")
);

-- AddForeignKey
ALTER TABLE "case_asset" ADD CONSTRAINT "case_asset_case_id_version_fkey" FOREIGN KEY ("case_id", "version") REFERENCES "case_version"("case_id", "version") ON DELETE CASCADE ON UPDATE CASCADE;
