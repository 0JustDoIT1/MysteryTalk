-- 화면 단순화(PRD v1.8): 수사 자료 폐지(D99), 사건 번호(D98), 정답 요소 개수 공개(D100).
-- 사건 번호·요소 개수는 사건 적재(content:load) 때 채운다.
ALTER TABLE "mystery_case" DROP COLUMN "case_file_json",
ADD COLUMN     "case_no" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "element_count" INTEGER NOT NULL DEFAULT 0;
