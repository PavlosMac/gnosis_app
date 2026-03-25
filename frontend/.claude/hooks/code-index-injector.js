#!/usr/bin/env node
/**
 * Inject CODE_INDEX.md into Claude's context on every prompt.
 * If CODE_INDEX.md is missing, warns on stderr but doesn't block.
 */

import { readFileSync, existsSync } from 'fs';

const CODE_INDEX_FILE = 'CODE_INDEX.md';
const MARKER = '<!-- CODE_INDEX_INJECTED -->';

let prompt = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  prompt += chunk;
});

process.stdin.on('end', () => {
  try {
    if (prompt.includes(MARKER)) {
      process.stdout.write(prompt);
      process.exit(0);
    }

    if (!existsSync(CODE_INDEX_FILE)) {
      process.stderr.write('CODE_INDEX.md not found. Run: npm run code-index\n');
      process.stdout.write(prompt);
      process.exit(0);
    }

    const codeIndex = readFileSync(CODE_INDEX_FILE, 'utf-8');
    const injected = `${MARKER}\n\n<code_structure>\n${codeIndex}\n</code_structure>\n\n---\n\n${prompt}`;

    process.stdout.write(injected);
  } catch (error) {
    process.stderr.write(`code-index-injector error: ${error.message}\n`);
    process.stdout.write(prompt);
  }
});
