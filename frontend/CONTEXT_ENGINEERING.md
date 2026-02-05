
# Context Engineering Guide
**How to Build Production-Grade AI Development with Claude Code**

*Version 1.0 - A living document for deliberate context engineering*

---

## Table of Contents

1. [Philosophy: Deduction Over Induction](#1-philosophy-deduction-over-induction)
2. [Memory Files: Your Context Foundation](#2-memory-files-your-context-foundation)
3. [Ctags + Hooks: Automatic Code Awareness](#3-ctags--hooks-automatic-code-awareness)
4. [Contract-Driven Development](#4-contract-driven-development)
5. [Skills Over MCPs](#5-skills-over-mcps)
6. [Semantic Outsourcing](#6-semantic-outsourcing)
7. [Deterministic Tooling & Validation](#7-deterministic-tooling--validation)
8. [Implementation Checklist](#8-implementation-checklist)
9. [Appendix: Example Files](#9-appendix-example-files)

---

## 1. Philosophy: Deduction Over Induction

### The Core Problem

When you ask an LLM to write code without explicit context, it **induces** patterns from its training data. It thinks: "Most Next.js apps I've seen do auth like X, so I'll do that."

**The result?** Generic, "average" code that doesn't fit YOUR architecture.

### The Solution: Force-Feed Context

Instead of letting the LLM guess, you explicitly provide:
- Your architecture patterns
- Your coding standards
- Your existing code structure
- Your constraints and rules

The LLM then **deduces** solutions from YOUR context, not from generic training data.

### Example

**Without Context (Induction):**
```
You: "Add password reset to my app"
Claude: *generates generic Auth0 code based on common patterns*
Result: Doesn't fit your patterns, uses wrong libraries, creates duplicate code
```

**With Context (Deduction):**
```
You: "Add password reset to my app"
+ CLAUDE.md with: "We use Auth0 EU tenant, Resend for emails, 
  Redis for tokens, FastAPI follows repository pattern..."
+ CODE_INDEX.md showing existing auth functions
Claude: *generates code that fits YOUR exact patterns*
Result: Uses your existing functions, follows your architecture, no duplicates
```

### Key Principle

**"Use deterministic code everywhere. Only use AI where AI is needed, but have the LLM write that deterministic code for you."**

---

## 2. Memory Files: Your Context Foundation

Memory files are natural language descriptions of your codebase that get automatically injected into every Claude interaction.

### What Goes in Memory Files

1. **Architecture Patterns** - How your code is structured
2. **Coding Standards** - Style guides and conventions  
3. **Technology Stack** - Exact versions and configurations
4. **Design Decisions** - Why you chose certain approaches
5. **Constraints** - What you DON'T want Claude to do

### Primary Memory File: CLAUDE.md

Create `CLAUDE.md` in your project root:

```markdown
# Project Context & Rules

## Project Overview
[Brief description of what your project does]

## Tech Stack
- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python 3.11+
- **Database**: MongoDB Atlas
- **Cache**: Redis
- **Auth**: Auth0 (EU tenant)

## Architecture Patterns

### Backend (FastAPI)
- **Pattern**: Routes → Services → Repositories
- **NO direct database calls in routes**
- **ALL models use Pydantic for validation**

### Frontend (Next.js)
- **Pattern**: Server Components by default
- **Client Components only when needed**

## Important Rules

### DO:
- ✅ Use existing functions/classes (check CODE_INDEX.md)
- ✅ Follow repository pattern
- ✅ Validate ALL input with Pydantic/Zod
- ✅ Add proper error handling

### DON'T:
- ❌ Create duplicate functions
- ❌ Skip type validation
- ❌ Use direct database queries in routes
- ❌ Hardcode credentials
```

### How to Inject Memory Files

Memory files must be **automatically injected** into every interaction. See Section 3 for implementation.

---

## 3. Ctags + Hooks: Automatic Code Awareness

**Goal:** Prevent Claude from creating duplicate code or hallucinating functions that don't exist.

### The Strategy

1. Generate a markdown index of your codebase using ctags
2. Automatically inject this index into Claude's context
3. Claude sees what code already exists before writing new code

### ✅ Step 1: Install Universal Ctags

```bash
# macOS
brew install universal-ctags

# Ubuntu/Debian
sudo apt install universal-ctags

# Verify
ctags --version
# Should say "Universal Ctags"
```

### ✅ Step 2: Configure Ctags

Create `.ctags.d/config.ctags`:

```ctags
--recurse=yes
--exclude=node_modules
--exclude=.git
--exclude=dist
--exclude=build
--exclude=__pycache__
--exclude=venv
--exclude=.next

--fields=+n
--languages=Python,TypeScript,JavaScript
```

### ✅ Step 3: Create Conversion Script

`scripts/ctags-to-markdown.js`:

```javascript
#!/usr/bin/env node
/**
 * Convert ctags JSON output to readable markdown
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
    
    // Skip noise
    if (tag.kind === 'unknown') return;
    if (tag.path.includes('node_modules')) return;
    if (tag.path.includes('.next')) return;
    if (tag.path.includes('dist')) return;
    
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
    // Skip invalid JSON
  }
});

rl.on('close', () => {
  console.log('# Codebase Structure Index');
  console.log('*Auto-generated - DO NOT EDIT MANUALLY*\n');
  
  const sortedFiles = Array.from(fileMap.keys()).sort();
  
  // Group by directory
  const backend = sortedFiles.filter(f => 
    f.startsWith('src/') || f.startsWith('backend/')
  );
  const frontend = sortedFiles.filter(f => 
    f.startsWith('app/') || f.startsWith('components/') || f.startsWith('lib/')
  );
  const other = sortedFiles.filter(f => 
    !backend.includes(f) && !frontend.includes(f)
  );
  
  if (backend.length > 0) {
    console.log('## Backend\n');
    backend.forEach(printFile);
  }
  
  if (frontend.length > 0) {
    console.log('\n## Frontend\n');
    frontend.forEach(printFile);
  }
  
  if (other.length > 0) {
    console.log('\n## Other\n');
    other.forEach(printFile);
  }
});

function printFile(file) {
  const tags = fileMap.get(file);
  console.log(`### ${file}`);
  tags.forEach(tag => {
    console.log(`- \`${tag.name}\` (${tag.kind}, line ${tag.line})`);
  });
  console.log('');
}
```

Make it executable:
```bash
chmod +x scripts/ctags-to-markdown.js
```

### ✅ Step 4: Create Generation Script

`scripts/generate-code-index.sh`:

```bash
#!/bin/bash
# Generate code index from ctags

set -e

OUTPUT_FILE="CODE_INDEX.md"

echo "Generating code index..."

ctags \
  --output-format=json \
  --fields=+n \
  -R \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=dist \
  --exclude=build \
  --exclude=__pycache__ \
  --exclude=venv \
  --exclude=.git \
  . 2>/dev/null | node scripts/ctags-to-markdown.js > "$OUTPUT_FILE"

echo "✓ Code index generated: $OUTPUT_FILE"
echo "  Lines: $(wc -l < $OUTPUT_FILE)"
```

Make it executable:
```bash
chmod +x scripts/generate-code-index.sh
```

### ✅ Step 5: Test Generation

```bash
./scripts/generate-code-index.sh

# Check the output
head -50 CODE_INDEX.md
```

You should see something like:

```markdown
# Codebase Structure Index

## Backend

### src/auth/service.py
- `login_user` (function, line 45)
- `reset_password` (function, line 78)
- `verify_email_token` (function, line 102)

### src/auth/repository.py
- `UserRepository` (class, line 12)
- `find_by_email` (method, line 34)
```

### 🔄 Step 6: Automatic Regeneration (Git Hooks)

Set up git hooks to automatically regenerate the index when code changes.

**Create `.git/hooks/post-checkout`:**

```bash
#!/bin/bash
# Regenerate code index after checkout

echo "🔄 Updating code index..."
./scripts/generate-code-index.sh

exit 0
```

**Create `.git/hooks/post-merge`:**

```bash
#!/bin/bash
# Regenerate code index after merge

echo "🔄 Updating code index..."
./scripts/generate-code-index.sh

exit 0
```

**Make them executable:**

```bash
chmod +x .git/hooks/post-checkout
chmod +x .git/hooks/post-merge
```

**Test:**

```bash
# Switch branches to trigger the hook
git checkout -b test-hooks

# You should see:
# 🔄 Updating code index...
# Generating code index...
# ✓ Code index generated: CODE_INDEX.md
```

### 🎯 Step 7: Inject into Claude Context

Create `.claude/hooks/code-index-injector.js`:

```javascript
#!/usr/bin/env node
/**
 * Inject CODE_INDEX.md into Claude's context
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
    // Skip if already injected
    if (prompt.includes(MARKER)) {
      process.stdout.write(prompt);
      process.exit(0);
    }

    // Check if CODE_INDEX exists
    if (!existsSync(CODE_INDEX_FILE)) {
      process.stderr.write('⚠️  CODE_INDEX.md not found\n');
      process.stdout.write(prompt);
      process.exit(0);
    }

    // Read and inject
    const codeIndex = readFileSync(CODE_INDEX_FILE, 'utf-8');
    const injected = `${MARKER}\n\n<code_structure>\n${codeIndex}\n</code_structure>\n\n---\n\n${prompt}`;
    
    process.stdout.write(injected);
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.stdout.write(prompt);
  }
});
```

Make it executable:
```bash
chmod +x .claude/hooks/code-index-injector.js
```

### 🎯 Step 8: Inject CLAUDE.md Rules

Create `.claude/hooks/rules-injector.js`:

```javascript
#!/usr/bin/env node
/**
 * Inject CLAUDE.md rules into context
 */

import { readFileSync, existsSync } from 'fs';

const RULES_FILE = 'CLAUDE.md';
const MARKER = '<!-- CLAUDE_RULES_INJECTED -->';

let prompt = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  prompt += chunk;
});

process.stdin.on('end', () => {
  // Skip if already injected
  if (prompt.includes(MARKER)) {
    process.stdout.write(prompt);
    process.exit(0);
  }

  // Check if CLAUDE.md exists
  if (!existsSync(RULES_FILE)) {
    process.stderr.write('⚠️  CLAUDE.md not found\n');
    process.stdout.write(prompt);
    process.exit(0);
  }

  // Read and inject
  const rules = readFileSync(RULES_FILE, 'utf-8');
  const injected = `${MARKER}\n\n<context_rules>\n${rules}\n</context_rules>\n\n---\n\n${prompt}`;
  
  process.stdout.write(injected);
});
```

Make it executable:
```bash
chmod +x .claude/hooks/rules-injector.js
```

### 🎯 Step 9: Configure Claude Code

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/rules-injector.js"
          },
          {
            "type": "command",
            "command": "node .claude/hooks/code-index-injector.js"
          }
        ]
      }
    ]
  }
}
```

### ✅ Step 10: Test the Complete Flow

```bash
# Restart Claude Code to pick up config changes

# Test with a prompt that would create duplicate code
claude "create a function to find user by email"
```

**Expected result:**
Claude sees your CODE_INDEX.md and responds:
```
I see you already have `find_by_email` in UserRepository (line 34).
Should I use that existing function or create a different one?
```

**Success!** Claude now has full awareness of your codebase.

---

## 4. Contract-Driven Development

### The Philosophy

Define your data structures and APIs in schemas FIRST. Let deterministic codegen (not AI) expand them into boilerplate.

**Why?**
- AI is unpredictable for boilerplate
- Schemas are self-documenting
- Type safety prevents bugs
- Schemas become part of your memory files

### Example: Pydantic Contracts (Python)

**Define contracts first:**

```python
# contracts/auth.py
from pydantic import BaseModel, EmailStr

class PasswordResetRequest(BaseModel):
    email: EmailStr
    
class PasswordResetResponse(BaseModel):
    success: bool
    message: str
    reset_token_sent: bool
    
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    
class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime
```

**Reference in CLAUDE.md:**

```markdown
## Contracts

ALL API endpoints MUST use contracts from `contracts/` folder.

- `contracts/auth.py` - Authentication endpoints
- `contracts/user.py` - User management
- `contracts/fish.py` - Fish monitoring

NEVER create inline Pydantic models. Always use defined contracts.
```

**Claude then writes:**

```python
# src/auth/routes.py
from contracts.auth import PasswordResetRequest, PasswordResetResponse

@router.post("/reset-password", response_model=PasswordResetResponse)
async def reset_password(request: PasswordResetRequest):
    # Business logic here
    ...
```

### Example: TypeScript Contracts

```typescript
// contracts/auth.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
}
```

### Other Contract Systems

- **Protobufs** - gRPC services
- **OpenAPI/Swagger** - REST APIs
- **GraphQL Schema** - GraphQL APIs
- **Zod** - Runtime TypeScript validation

---

## 5. Skills Over MCPs

### The Problem with MCPs

MCPs (Model Context Protocol) are Anthropic's tool system. They're powerful but:
- Add significant tokens to context
- Complex schemas eat your context window
- The LLM has to "learn" each MCP

### Skills: Lightweight Automation

**Skills** are simple bash/Python scripts that:
- Automate repetitive tasks
- Teach Claude patterns
- Are fast and token-efficient

### Example: MongoDB Query Analyzer

**Instead of a heavy MCP:**

```json
{
  "name": "analyze_mongodb_query",
  "description": "Analyzes MongoDB queries...",
  "parameters": {
    "collection": {"type": "string"},
    "query": {"type": "object"},
    "explain": {"type": "boolean"}
  }
}
```

**Create a lightweight skill:**

```bash
#!/bin/bash
# skills/analyze-query.sh

collection=$1
query=$2

mongo-explain --collection=$collection --query="$query" | format-output
```

**Reference in CLAUDE.md:**

```markdown
## Available Skills

- `./skills/analyze-query.sh <collection> <query>` - Analyze MongoDB performance
- `./skills/test-endpoint.sh <url>` - Test API endpoint
- `./skills/check-redis.sh <key>` - Check Redis cache

Run these BEFORE writing complex code.
```

### When to Create a Skill

If you find yourself:
- Running the same command repeatedly
- Checking the same thing manually
- Explaining the same process to Claude

→ **Script it as a skill**

---

## 6. Semantic Outsourcing

### The Problem

Complex requests waste reasoning tokens because Claude has to:
1. Understand the request
2. Break it down into steps
3. Execute each step

### The Solution: Planning Agent

Use a separate "planner" agent to do the heavy reasoning, then feed atomic actions to the executor.

**Traditional (wasteful):**
```
You: "Implement password reset with email, rate limiting, audit logs"
Claude: *500+ tokens reasoning about steps*
        *then executes*
```

**Semantic Outsourcing (efficient):**
```
You: "Implement password reset..."
  ↓
Planning Agent (headless):
  - Shares same memory files
  - Decomposes into atomic actions:
    1. Create password_reset_token table
    2. Add rate_limit decorator
    3. Implement email service
    4. Add audit logging
    5. Write tests
  ↓
Execution Agent:
  - Receives pre-digested plan
  - Spends tokens on SOLVING, not PLANNING
```

### Implementation

This uses Claude Code's planning mode, automated via a hook.

**Create `.claude/hooks/user-prompt-submit-planner.js`:**

```javascript
#!/usr/bin/env node
/**
 * Detect complex requests and trigger planning mode
 */

import { execSync } from 'child_process';

let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);

process.stdin.on('end', () => {
  // Detect complexity (heuristic)
  const isComplex = 
    prompt.split('and').length > 3 ||
    prompt.split(',').length > 3 ||
    /implement|create|build|add.*with/i.test(prompt);
  
  if (isComplex) {
    // Trigger planning mode (implementation depends on Claude Code)
    process.stderr.write('🧠 Complex request detected, using planning mode\n');
  }
  
  process.stdout.write(prompt);
});
```

---

## 7. Deterministic Tooling & Validation

### Move Reasoning Earlier in the Stack

**The Goal:** Validate and enforce patterns BEFORE AI runs, not during debugging.

### Validation Stack

**❌ Bad (AI does validation):**
```python
@app.post("/reset-password")
async def reset(data: dict):  # Loose typing
    # Claude figures out validation
    if not data.get("email"):
        raise ValueError("Email required")
```

**✅ Good (Deterministic validation):**
```python
@app.post("/reset-password")
async def reset(data: PasswordResetRequest):  # Contract
    # Pydantic already validated
    # Claude focuses on business logic
```

### Pre-Commit Validation

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Validate architecture before commit

# Check: No direct DB calls in routes
if grep -r "db\." src/*/routes.py 2>/dev/null; then
    echo "❌ Found direct DB calls in routes"
    exit 1
fi

# Check: All endpoints use contracts
if ! grep -r "response_model=" src/*/routes.py | grep -q "contracts\."; then
    echo "⚠️  Some endpoints may not use contracts"
fi

# Run linters
npm run lint || exit 1
```

---

## 8. Implementation Checklist

### Phase 1: Foundation (Today)

- [ ] Create `CLAUDE.md` with your architecture patterns
- [ ] Install universal-ctags
- [ ] Create ctags conversion script
- [ ] Generate initial `CODE_INDEX.md`
- [ ] Test: `./scripts/generate-code-index.sh`

### Phase 2: Automation (This Week)

- [ ] Set up git hooks (post-checkout, post-merge)
- [ ] Test git hooks by switching branches
- [ ] Create `.claude/hooks/rules-injector.js`
- [ ] Create `.claude/hooks/code-index-injector.js`
- [ ] Configure `.claude/settings.json`
- [ ] Test: Restart Claude Code and verify injection

### Phase 3: Contracts (This Week)

- [ ] Create `contracts/` folder
- [ ] Define Pydantic models for all endpoints
- [ ] Update CLAUDE.md to reference contracts
- [ ] Refactor existing code to use contracts

### Phase 4: Skills (Next Week)

- [ ] Identify 3-5 repetitive tasks
- [ ] Create skills scripts
- [ ] Document skills in CLAUDE.md
- [ ] Test skills with Claude

### Phase 5: Advanced (Next Month)

- [ ] Set up semantic outsourcing (planning mode)
- [ ] Add pre-commit validation hooks
- [ ] Create architecture enforcement scripts
- [ ] Build skills library

---

## 9. Appendix: Example Files

### Complete CLAUDE.md Template

```markdown
# Project Context & Rules

## Project Overview
TiVA IoT fish monitoring system with authentication and real-time data processing.

## Tech Stack
- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, Konva.js for canvas
- **Backend**: FastAPI 0.109+, Python 3.11+
- **Database**: MongoDB Atlas (v7.0)
- **Cache**: Redis (Upstash)
- **Auth**: Auth0 (EU tenant)
- **Email**: Resend
- **Deployment**: Fly.io
- **Real-time**: WebSockets

## Architecture Patterns

### Backend (FastAPI)
**Pattern**: Routes → Services → Repositories

```
routes.py    # FastAPI endpoints, request validation
  ↓
service.py   # Business logic
  ↓
repository.py  # Data access layer
```

**Rules:**
- NO direct database calls in routes
- ALL models use Pydantic for validation
- Repository pattern for ALL data access
- Use async/await everywhere
- Type hints required on all functions

### Frontend (Next.js)
**Pattern**: Server Components by default

- Server Components for data fetching
- Client Components ONLY for interactivity
- API calls via fetch with TypeScript types
- Use React Server Actions where possible

### Database Access
- Repository pattern ONLY
- NO raw MongoDB queries in services
- Use aggregation pipelines for complex queries
- Index all frequently queried fields

## Coding Standards

### Python
```python
# Use async/await everywhere
async def get_user(user_id: str) -> User:
    return await user_repository.find_by_id(user_id)

# Type hints required
def process_data(data: dict[str, Any]) -> ProcessedData:
    ...

# Pydantic for all request/response models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
```

### TypeScript
```typescript
// Explicit return types
export async function loginUser(
  credentials: LoginRequest
): Promise<LoginResponse> {
  ...
}

// No 'any' types unless absolutely necessary
// Use strict mode
```

## File Structure
```
backend/
├── src/
│   ├── auth/
│   │   ├── models.py       # Pydantic models
│   │   ├── repository.py   # Data access
│   │   ├── service.py      # Business logic
│   │   └── routes.py       # API endpoints
│   └── fish/
│       └── ...

frontend/
├── app/                    # Next.js App Router
├── components/            # React components
└── lib/
    ├── api/              # API client functions
    └── types/            # TypeScript types

contracts/                # Pydantic contracts
├── auth.py
├── user.py
└── fish.py
```

## Contracts

ALL API endpoints MUST use contracts from `contracts/` folder.

- `contracts/auth.py` - Authentication endpoints
- `contracts/user.py` - User management  
- `contracts/fish.py` - Fish monitoring

NEVER create inline Pydantic models. Always use defined contracts.

## Available Skills

- `./skills/analyze-query.sh <collection> <query>` - Analyze MongoDB performance
- `./skills/test-endpoint.sh <url>` - Test API endpoint with auth
- `./skills/check-redis.sh <key>` - Check Redis cache value

## Important Rules

### DO:
- ✅ Check CODE_INDEX.md for existing functions before creating new ones
- ✅ Follow repository pattern for database access
- ✅ Validate ALL input with Pydantic/Zod
- ✅ Add proper error handling with try/except
- ✅ Write tests for new features
- ✅ Use async/await for I/O operations
- ✅ Add type hints to all functions
- ✅ Use contracts from contracts/ folder

### DON'T:
- ❌ Create duplicate functions
- ❌ Skip type validation
- ❌ Use direct MongoDB queries in routes or services
- ❌ Hardcode credentials or secrets
- ❌ Ignore error cases
- ❌ Create inline Pydantic models
- ❌ Use synchronous I/O in async functions
- ❌ Use 'any' type in TypeScript

## Current Focus Areas
*Update this section with what you're currently working on*

- GDPR compliance (cookie consent, privacy policy)
- MongoDB Atlas Search for multilingual content
- Redis session management improvements
- Real-time fish data streaming optimization

## External Resources
- Auth0 Tenant: EU region
- MongoDB Atlas: Production cluster
- Upstash Redis: Connection details in .env
- Fly.io: Deployment via GitHub Actions
```

### Complete .claude/settings.json

```json
{
  "permissions": {
    "allow": [
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git diff:*)",
      "Bash(find:*)",
      "Bash(cat:*)",
      "mcp__ide__getDiagnostics"
    ],
    "deny": [],
    "ask": []
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/rules-injector.js"
          },
          {
            "type": "command",
            "command": "node .claude/hooks/code-index-injector.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/protect-secrets.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npm run format"
          }
        ]
      }
    ]
  }
}
```

---

## Credits & Resources

This guide is based on principles from:
- [Reddit: r/ClaudeCode - Production AI Systems](https://reddit.com/r/ClaudeCode)
- [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)

**Philosophy:** "Deliberate context engineering is the only way to leverage AI to build production systems that scale. Shift-left reasoning as early as possible in the stack."

---

*This is a living document. Update it as you discover new patterns and techniques.*
