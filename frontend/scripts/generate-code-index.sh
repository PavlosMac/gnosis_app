#!/bin/bash
# Generate CODE_INDEX.md from ctags
set -e

OUTPUT_FILE="CODE_INDEX.md"

ctags \
  --output-format=json \
  --fields=+n \
  --languages=TypeScript,JavaScript \
  -R \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=dist \
  --exclude=build \
  --exclude=.git \
  --exclude=.claude \
  . 2>/dev/null | node scripts/ctags-to-markdown.js > "$OUTPUT_FILE"

echo "CODE_INDEX generated: $(wc -l < "$OUTPUT_FILE") lines" >&2
