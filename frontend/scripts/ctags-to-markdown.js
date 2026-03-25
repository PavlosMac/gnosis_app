#!/usr/bin/env node
/**
 * Convert ctags JSON output to readable markdown
 * Usage: ctags --output-format=json -R . | node scripts/ctags-to-markdown.js
 */

import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const fileMap = new Map();

rl.on('line', (line) => {
  try {
    const tag = JSON.parse(line);

    if (tag.kind === 'unknown') return;
    if (tag.path.includes('node_modules')) return;
    if (tag.path.includes('.next')) return;
    if (tag.path.includes('dist')) return;
    if (tag.path.includes('.claude/')) return;

    const file = tag.path;
    if (!fileMap.has(file)) {
      fileMap.set(file, []);
    }

    fileMap.get(file).push({
      name: tag.name,
      kind: tag.kind,
      line: tag.line || '?'
    });
  } catch (e) {
    // Skip invalid JSON lines
  }
});

rl.on('close', () => {
  console.log('# Codebase Structure Index');
  console.log('*Auto-generated - DO NOT EDIT MANUALLY*\n');

  const sortedFiles = Array.from(fileMap.keys()).sort();

  const src = sortedFiles.filter(f => f.startsWith('src/'));
  const other = sortedFiles.filter(f => !src.includes(f));

  if (src.length > 0) {
    console.log('## Backend\n');
    src.forEach(printFile);
  }

  if (other.length > 0) {
    console.log('\n## Other\n');
    other.forEach(printFile);
  }
});

const printFile = (file) => {
  const tags = fileMap.get(file);
  console.log(`### ${file}`);
  tags.forEach(tag => {
    console.log(`- \`${tag.name}\` (${tag.kind}, line ${tag.line})`);
  });
  console.log('');
};
