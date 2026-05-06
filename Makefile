.PHONY: install dev test build lint typecheck format clean

install:
	pnpm install

dev:
	pnpm dev

test:
	pnpm test

build:
	pnpm build

lint:
	pnpm lint

typecheck:
	pnpm typecheck

format:
	pnpm format

clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/*/.next apps/*/dist packages/*/dist
