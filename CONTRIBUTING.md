# Contributing to LineupCast OS

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork and create a branch
3. Run `make install` to set up dependencies
4. Make your changes
5. Run `make lint && make typecheck && make test` before committing
6. Open a pull request

## Project Structure

```
apps/
  web/        → Next.js frontend (App Router)
  api/        → FastAPI backend
packages/
  schema/     → Shared TypeScript types and validation
  providers/  → Data source adapters
  prediction/ → Match prediction engine
  ai-script/  → Commentary script generator
  overlay-renderer/ → Broadcast graphic export
docs/
  model-cards/ → Prediction model documentation
```

## Guidelines

- **TypeScript** — strict mode, ESM, no `any` without justification
- **Python** — type hints required, Pydantic models for API contracts
- **Commits** — use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Tests** — add tests for new features; don't break existing ones
- **Data** — only use freely-available, open data sources. No commercial API keys.

## Code Style

- Prettier handles formatting (run `make format`)
- ESLint handles linting (run `make lint`)
- mypy handles Python type checking

## Questions?

Open a discussion or issue on GitHub.
