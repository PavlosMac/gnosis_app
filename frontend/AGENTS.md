# AGENTS.md

This file provides guidance for AI coding agents (Cursor, GitHub Copilot, etc.) when working with code in this repository.

## Project Overview

Tarot Divinations is a Next.js 15 application that provides tarot card readings and significator calculations. The app features an interactive tarot oracle, card shuffling animations, and personalized significator analysis based on birth dates using the Taroscopic System.

## Code Style

- Follow TypeScript strict mode
- Use functional components with TypeScript interfaces
- Use ES6 syntax, fat arrow functions, and destructuring
- Tailwind CSS 4 for styling
- Dark mystical theme with Egyptian/esoteric aesthetics

## Project Memory System

This project maintains institutional knowledge in `docs/project_notes/` for consistency across sessions.

### Memory Files

- **bugs.md** - Bug log with dates, solutions, and prevention notes
- **decisions.md** - Architectural Decision Records (ADRs) with context and trade-offs
- **key_facts.md** - Project configuration, ports, important URLs
- **issues.md** - Work log with descriptions and status

### Memory-Aware Protocols

**Before proposing architectural changes:**
- Check `docs/project_notes/decisions.md` for existing decisions
- Verify the proposed approach doesn't conflict with past choices
- If it does conflict, acknowledge the existing decision and explain why a change is warranted

**When encountering errors or bugs:**
- Search `docs/project_notes/bugs.md` for similar issues
- Apply known solutions if found
- Document new bugs and solutions when resolved

**When looking up project configuration:**
- Check `docs/project_notes/key_facts.md` for ports, URLs, service accounts
- Prefer documented facts over assumptions

**When completing work:**
- Log completed work in `docs/project_notes/issues.md`
- Include date, brief description, and status

**When user requests memory updates:**
- Update the appropriate memory file (bugs, decisions, key_facts, or issues)
- Follow the established format and style (bullet lists, dates, concise entries)
