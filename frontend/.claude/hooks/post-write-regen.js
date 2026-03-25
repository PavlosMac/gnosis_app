#!/usr/bin/env node
/**
 * PostToolUse hook: regenerate CODE_INDEX.md after Edit/Write operations.
 * Runs silently — only logs on error.
 */

import { execSync } from 'child_process';

try {
  execSync('./scripts/generate-code-index.sh', { stdio: 'pipe' });
} catch (error) {
  process.stderr.write(`code-index regen failed: ${error.message}\n`);
}
