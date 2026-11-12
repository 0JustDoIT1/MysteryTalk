import { createHash } from 'node:crypto';

/**
 * 운영 집계 단위(SPEC §10). 하루·한 달은 한국 시간 기준으로 자른다(플레이어가 체감하는 '오늘').
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 한국 시간 기준 날짜(YYYY-MM-DD) */
export function dayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 한국 시간 기준 월(YYYY-MM) */
export function monthKey(now: Date = new Date()): string {
  return dayKey(now).slice(0, 7);
}

/**
 * IP 해시: 비밀값 + 날짜 + IP. IP 원문은 저장하지 않고, 날짜가 바뀌면 같은 IP라도 다른 값이 돼
 * 날을 넘겨 추적할 수 없다(SPEC §10).
 */
export function ipHash(ip: string, secret: string, day: string): string {
  return createHash('sha256').update(`${secret}|${day}|${ip}`, 'utf8').digest('hex');
}
