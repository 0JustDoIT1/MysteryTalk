#!/usr/bin/env node
// UserPromptSubmit 훅: 매 요청마다 /refine 절차를 상기시키는 문맥을 넣는다.
// 슬래시 명령(/task, /refine 등)으로 시작하는 요청에는 넣지 않는다.
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let prompt = '';
try {
  prompt = String(JSON.parse(raw)?.prompt ?? '');
} catch {
  process.exit(0);
}
if (prompt.trimStart().startsWith('/')) process.exit(0);

const context = [
  '[작업 절차 알림] 이 요청이 코드·설정·문서를 바꾸는 새 작업이면 `.claude/commands/refine.md` 절차를 따른다:',
  '해석 → (흔한 부품·표준 문제면) 기존 해법 확인 → 작업 프롬프트 제시 → "이대로 진행할까요?" 승인 후 구현.',
  '예외(바로 진행): 질문·조회, 실행·커밋·푸시 요청, 직전에 제시한 작업 프롬프트·제안의 승인("진행해줘", "적용해줘" 등), 오타 수준의 아주 작은 수정.',
].join('\n');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
  }),
);
