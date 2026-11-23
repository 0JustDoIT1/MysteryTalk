#!/usr/bin/env node
// PreToolUse(Bash·PowerShell) 훅 진입점. 규칙은 guard-rules.mjs.
// 막을 때는 exit 2 + stderr(이유가 Claude에게 전달된다). 입력을 읽지 못하면 통과시킨다.
import { check } from './guard-rules.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}
const reason = check(input?.tool_input?.command, input?.cwd);
if (reason) {
  process.stderr.write(`[가드] ${reason}
`);
  process.exit(2);
}
