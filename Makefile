.PHONY: install dev test lint deploy

install:
	$(MAKE) -C backend install
	cd frontend && npm ci

dev:
	# both servers, prefixed output, one Ctrl+C stops both.
	# sed -l = line-buffered (BSD sed on macOS; GNU sed would be -u).
	@trap 'kill 0' EXIT INT TERM; \
	( $(MAKE) -C backend dev 2>&1 | sed -l 's/^/[backend] /' ) & \
	( cd frontend && npm run dev 2>&1 | sed -l 's/^/[frontend] /' ) & \
	wait

test:
	$(MAKE) -C backend test
	cd frontend && npm test

lint:
	$(MAKE) -C backend lint
	cd frontend && npm run lint

deploy:
	cd backend && ./deploy-to-pi.sh
	cd frontend && ./deploy-to-pi.sh
