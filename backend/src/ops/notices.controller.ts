import { Controller, Get } from '@nestjs/common';
import type { Notice } from '@mysterytalk/shared';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNotices } from './notices.js';

/** 공지 폴더: 저장소의 content/notices(배포 시 함께 포함). 소스(src/ops)와 빌드 결과(dist/...) 양쪽에서 찾는다. */
const NOTICES_DIR =
  [
    resolve(import.meta.dirname, '../../../content/notices'),
    resolve(import.meta.dirname, '../../../../content/notices'),
  ].find((d) => existsSync(d)) ?? resolve(import.meta.dirname, '../../../content/notices');

/**
 * 공지(SPEC §5 GET /notices, PRD D41). 공개 정보라 플레이어 식별이 필요 없다.
 * 파일은 배포할 때만 바뀌므로 처음 읽은 내용을 그대로 쓴다.
 */
@Controller('notices')
export class NoticesController {
  private cache: Notice[] | null = null;

  @Get()
  list(): Notice[] {
    this.cache ??= readNotices(NOTICES_DIR);
    return this.cache;
  }
}
