#!/usr/bin/env node
/**
 * Generate CODE_INDEX.md — LLM-optimized codebase routing table.
 *
 * Two-pass strategy:
 * 1. Parse source files directly for exports and directives
 * 2. Use ctags (stdin) for non-exported top-level declarations
 *
 * Filters: no local vars, no properties, no duplicates, no anonymous tags.
 * Groups by project layer with client/server directive tags.
 *
 * Usage: ctags --output-format=json --fields=+nS ... | node scripts/ctags-to-markdown.js
 */

import { createInterface } from 'readline';
import { readFileSync } from 'fs';

// ── Section routing — first match wins ─────────────────────────────

const SECTIONS = [
  { title: 'Components',     test: f => f.startsWith('src/components/') },
  { title: 'Pages & Layouts', test: f => f.startsWith('src/app/') && /\/(page|layout|not-found)\.(ts|tsx)$/.test(f) },
  { title: 'Providers',       test: f => f.includes('/providers/') },
  { title: 'Server Actions',  test: f => f.endsWith('/actions.ts') },
  { title: 'Libraries',       test: f => f.startsWith('src/lib/') },
  { title: 'Services',        test: f => f.startsWith('src/services/') },
  { title: 'Types',           test: f => f.startsWith('src/types/') },
  { title: 'Constants',       test: f => f.startsWith('src/constants/') },
  { title: 'Infrastructure',  test: f => f.startsWith('src/') },
];

// ── Source parser: exports + directives ─────────────────────────────

const EXPORT_RE = /^export\s+(default\s+)?(const|let|var|function|async\s+function|class|interface|type|enum)\s+(\w+)/gm;
const DEFAULT_IDENT_RE = /^export\s+default\s+(\w+)\s*;?\s*$/gm;
const KEYWORDS = new Set(['function', 'class', 'true', 'false', 'null', 'undefined']);

const classifyName = (name, syntaxKind) => {
  if (['const', 'let', 'var'].includes(syntaxKind)) {
    if (/^[A-Z][A-Z0-9_]+$/.test(name)) return 'constant';
    if (/^[A-Z]/.test(name)) return 'component';
    return 'function';
  }
  return syntaxKind;
};

const parseSource = (filePath) => {
  let content;
  try { content = readFileSync(filePath, 'utf-8'); } catch { return null; }

  const isClient = /['"]use client['"]/.test(content);
  const isServer = /['"]use server['"]/.test(content);
  const exports = new Map();

  let m;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(content)) !== null) {
    const isDefault = !!m[1];
    const kind = classifyName(m[3], m[2].replace('async ', ''));
    exports.set(m[3], { kind, isDefault });
  }

  DEFAULT_IDENT_RE.lastIndex = 0;
  while ((m = DEFAULT_IDENT_RE.exec(content)) !== null) {
    const name = m[1];
    if (KEYWORDS.has(name)) continue;
    if (exports.has(name)) { exports.get(name).isDefault = true; }
    else { exports.set(name, { kind: /^[A-Z]/.test(name) ? 'component' : 'function', isDefault: true }); }
  }

  return { exports, isClient, isServer };
};

// ── File data store ────────────────────────────────────────────────

const fileMap = new Map();

const ensureFile = (path) => {
  if (!fileMap.has(path)) {
    const src = parseSource(path);
    fileMap.set(path, {
      exports: src?.exports ?? new Map(),
      internals: [],
      isClient: src?.isClient ?? false,
      isServer: src?.isServer ?? false,
    });
  }
  return fileMap.get(path);
};

// ── ctags stream: non-exported top-level declarations ──────────────

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  try {
    const tag = JSON.parse(line);

    if (!tag.path.startsWith('src/')) return;
    if (tag.name.startsWith('anonymous') || tag.name.length <= 2) return;
    if (tag.kind === 'property' || tag.kind === 'unknown') return;
    if (tag.scope) return; // nested — skip

    const file = ensureFile(tag.path);
    if (file.exports.has(tag.name)) return; // already captured as export

    if (tag.kind === 'constant' || tag.kind === 'variable') {
      if (/^[A-Z][A-Z0-9_]+$/.test(tag.name)) file.internals.push({ name: tag.name, kind: 'constant' });
      else if (/^[A-Z][a-zA-Z0-9]+$/.test(tag.name)) file.internals.push({ name: tag.name, kind: 'component' });
      return;
    }

    file.internals.push({ name: tag.name, kind: tag.kind });
  } catch { /* skip */ }
});

rl.on('close', () => {
  const output = new Map();

  for (const [path, data] of fileMap) {
    const lines = [];
    const seen = new Set();

    for (const [name, { kind, isDefault }] of data.exports) {
      seen.add(name);
      const tag = isDefault ? ' *default*' : '';
      lines.push(`- \`${name}\` — ${kind}${tag}`);
    }

    for (const { name, kind } of data.internals) {
      if (seen.has(name)) continue;
      seen.add(name);
      lines.push(`- \`${name}\` — ${kind}`);
    }

    if (lines.length) output.set(path, { lines, isClient: data.isClient, isServer: data.isServer });
  }

  // Render
  console.log('# Codebase Structure Index');
  console.log('*Auto-generated — exports + top-level declarations*\n');

  const remaining = new Set(output.keys());

  for (const { title, test } of SECTIONS) {
    const files = Array.from(remaining).filter(test).sort();
    if (!files.length) continue;
    files.forEach(f => remaining.delete(f));

    console.log(`## ${title}\n`);
    for (const file of files) {
      const { lines, isClient, isServer } = output.get(file);
      const dir = isClient ? ' `(client)`' : isServer ? ' `(server)`' : '';
      console.log(`### ${file}${dir}`);
      lines.forEach(l => console.log(l));
      console.log('');
    }
  }
});
