#!/usr/bin/env node
/**
 * Protect Secrets - PreToolUse Hook for Read|Edit|Write|Bash
 * Prevents reading, modifying, or exfiltrating .env files.
 *
 * Setup: already wired in .claude/settings.local.json
 */

const ALLOWLIST = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
];

const SENSITIVE_FILES = [
  { regex: /(?:^|\/)\.env$/, reason: '.env file contains secrets' },
  { regex: /(?:^|\/)\.env\.local$/, reason: '.env.local file contains secrets' },
  { regex: /(?:^|\/)\.env\.[^/]*$/, reason: '.env file contains secrets' },
];

const BASH_PATTERNS = [
  {
    regex: /\b(cat|less|head|tail|more|bat|view)\s+[^|;]*\.env\b/i,
    reason: 'Reading .env file exposes secrets',
  },
  {
    regex: /\bsource\s+[^|;]*\.env\b|(?:^|[;&|]\s*)\.\s+[^|;]*\.env\b/i,
    reason: 'Sourcing .env loads secrets into environment',
  },
  {
    regex: /\becho\b[^;|&]*\$\{?[A-Za-z_]*(?:SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL|API_KEY|AUTH|PRIVATE)[A-Za-z_]*\}?/i,
    reason: 'Echoing secret environment variable',
  },
  {
    regex: /\bprintf\b[^;|&]*\$\{?[A-Za-z_]*(?:SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL|API_KEY|AUTH|PRIVATE)[A-Za-z_]*\}?/i,
    reason: 'Printing secret environment variable',
  },
  {
    regex: /\bprintenv\b|(?:^|[;&|]\s*)env\s*(?:$|[;&|])/,
    reason: 'Environment dump may expose secrets',
  },
  {
    regex: /\b(cp|mv|rm)\b[^;|&]*\.env\b/i,
    reason: 'Modifying .env file',
  },
  {
    regex: /\bcurl\b[^;|&]*(-d\s*@|-F\s*[^=]+=@|--data[^=]*=@)[^;|&]*\.env/i,
    reason: 'Uploading .env via curl',
  },
  {
    regex: />\s*\.env\b/i,
    reason: 'Redirecting output to .env file',
  },
];

function isAllowlisted(filePath) {
  return filePath && ALLOWLIST.some((p) => p.test(filePath));
}

function checkFilePath(filePath) {
  if (!filePath || isAllowlisted(filePath)) return null;
  for (const p of SENSITIVE_FILES) {
    if (p.regex.test(filePath)) return p;
  }
  return null;
}

function checkBashCommand(cmd) {
  if (!cmd) return null;
  for (const allow of ALLOWLIST) {
    if (allow.test(cmd)) return null;
  }
  for (const p of BASH_PATTERNS) {
    if (p.regex.test(cmd)) return p;
  }
  return null;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  try {
    const { tool_name, tool_input } = JSON.parse(input);

    if (!['Read', 'Edit', 'Write', 'Bash'].includes(tool_name)) {
      return console.log('{}');
    }

    let match = null;
    if (['Read', 'Edit', 'Write'].includes(tool_name)) {
      match = checkFilePath(tool_input?.file_path);
    } else if (tool_name === 'Bash') {
      match = checkBashCommand(tool_input?.command);
    }

    if (match) {
      const action = { Read: 'read', Edit: 'modify', Write: 'write to', Bash: 'execute' }[tool_name];
      return console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `🔐 Blocked: Cannot ${action} — ${match.reason}`,
          },
        })
      );
    }

    console.log('{}');
  } catch (e) {
    console.log('{}');
  }
}

main();
