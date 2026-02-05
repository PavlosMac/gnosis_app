#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';

const RULES_FILE = 'CLAUDE.md';
const MARKER = '<!-- CLAUDE_RULES_INJECTED -->';

let prompt = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  prompt += chunk;
});

process.stdin.on('end', () => {
  if (prompt.includes(MARKER)) {
    process.stdout.write(prompt);
    process.exit(0);
  }

  if (!existsSync(RULES_FILE)) {
    process.stderr.write('⚠️  CLAUDE.md not found\n');
    process.stdout.write(prompt);
    process.exit(0);
  }

  const rules = readFileSync(RULES_FILE, 'utf-8');
  const injected = `${MARKER}\n\n<context_rules>\n${rules}\n</context_rules>\n\n---\n\n${prompt}`;
  
  process.stdout.write(injected);
});