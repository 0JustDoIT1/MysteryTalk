import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLegal, placeholdersIn, splitPlaceholders } from './legal';

const SAMPLE = `---
title: 이용약관
version: 초안 0.1
updated: 2026-11-19
effective: [시행일]
---
## 제1조 목적

첫 줄
이어지는 줄

- 항목 1
- 항목 2
문단으로 돌아옴

### 소제목
`;

describe('약관 문안 변환', () => {
  it('머리말·제목·문단·목록을 나눈다', () => {
    const doc = parseLegal(SAMPLE.replace(/\n/g, '\r\n'));
    expect(doc.meta).toEqual({
      title: '이용약관',
      version: '초안 0.1',
      updated: '2026-11-19',
      effective: '[시행일]',
    });
    expect(doc.blocks).toEqual([
      { type: 'h2', text: '제1조 목적' },
      { type: 'p', text: '첫 줄 이어지는 줄' },
      { type: 'ul', items: ['항목 1', '항목 2'] },
      { type: 'p', text: '문단으로 돌아옴' },
      { type: 'h3', text: '소제목' },
    ]);
  });

  it('머리말이 없으면 거부한다', () => {
    expect(() => parseLegal('## 제목\n')).toThrow();
  });

  it('자리표시를 따로 표시하고 목록으로 모은다', () => {
    expect(splitPlaceholders('책임자 [운영자 성명], 연락처 [문의 이메일]')).toEqual([
      { text: '책임자 ', placeholder: false },
      { text: '[운영자 성명]', placeholder: true },
      { text: ', 연락처 ', placeholder: false },
      { text: '[문의 이메일]', placeholder: true },
    ]);
    expect(placeholdersIn(parseLegal(SAMPLE))).toEqual(['[시행일]']);
  });

  it.each([
    ['terms.md', ['[시행일]']],
    // 처리방침은 보호책임자 성명이 법정 기재 사항(개인정보 보호법 제30조 제1항 제6호)이라 출시 전에 채운다
    ['privacy.md', ['[시행일]', '[운영자 성명]']],
  ])('실제 문안 %s 을 읽고, 채울 자리가 남아 있다', (file, expected) => {
    const doc = parseLegal(readFileSync(join(__dirname, '../../legal', file), 'utf8'));
    expect(doc.blocks.filter((b) => b.type === 'h2').length).toBeGreaterThan(5);
    expect(placeholdersIn(doc)).toEqual(expect.arrayContaining(expected));
    expect(doc.blocks.some((b) => JSON.stringify(b).includes('0justdoit1@gmail.com'))).toBe(true);
  });
});
