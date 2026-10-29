.PHONY: demo check deploy
demo:
	@test -d node_modules || npm ci
	npm run dev

check:
	npm test
	npm run typecheck
	npm run build
	npm run model:check

deploy:
	npm run deploy
