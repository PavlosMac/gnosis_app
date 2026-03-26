#!/bin/bash
# Generate CODE_INDEX.md — LLM-optimized codebase index
set -e

OUTPUT_FILE="CODE_INDEX.md"

ctags \
  --output-format=json \
  --fields=+nS \
  --languages=TypeScript,JavaScript \
  --map-TypeScript=+.tsx \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=dist \
  --exclude=build \
  --exclude=.git \
  --exclude=.claude \
  --exclude=scripts \
  -R \
  . 2>/dev/null | node scripts/ctags-to-markdown.js > "$OUTPUT_FILE"

echo "CODE_INDEX generated: $(wc -l < "$OUTPUT_FILE") lines" >&2
