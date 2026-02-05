#!/usr/bin/env node
/**
 * Inject CODE_INDEX.md into context
 * Optionally regenerate if stale
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

const CODE_INDEX_FILE = 'CODE_INDEX.md';
const MARKER = '<!-- CODE_INDEX_INJECTED -->';
const AUTO_REGENERATE = false; // Set to true for automatic regeneration

// Check if regeneration is needed
function needsRegeneration() {
  if (!existsSync(CODE_INDEX_FILE)) return true;
  
  // Check if any source files are newer (simple check)
  try {
    const indexTime = statSync(CODE_INDEX_FILE).mtime;
    const srcDirs = ['src', 'app', 'components', 'lib'].filter(existsSync);
    
    for (const dir of srcDirs) {
      const result = execSync(`find ${dir} -type f -newer ${CODE_INDEX_FILE} 2>/dev/null | head -1`, {
        encoding: 'utf8'
      }).trim();
      
      if (result) return true;
    }
  } catch (e) {
    // If check fails, don't regenerate
  }
  
  return false;
}

// Main
let prompt = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  prompt += chunk;
});

process.stdin.on('end', () => {
  try {
    // Skip if already injected
    if (prompt.includes(MARKER)) {
      process.stdout.write(prompt);
      process.exit(0);
    }

    // Regenerate if needed and enabled
    if (AUTO_REGENERATE && needsRegeneration()) {
      process.stderr.write('🔄 Regenerating CODE_INDEX.md...\n');
      execSync('./scripts/generate-code-index.sh', { stdio: 'inherit' });
    }

    // Check if CODE_INDEX exists
    if (!existsSync(CODE_INDEX_FILE)) {
      process.stderr.write('⚠️  CODE_INDEX.md not found. Run: ./scripts/generate-code-index.sh\n');
      process.stdout.write(prompt);
      process.exit(0);
    }

    // Read and inject code index
    const codeIndex = readFileSync(CODE_INDEX_FILE, 'utf-8');
    const injected = `${MARKER}\n\n<code_structure>\n${codeIndex}\n</code_structure>\n\n---\n\n${prompt}`;
    
    process.stdout.write(injected);
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.stdout.write(prompt);
  }
});