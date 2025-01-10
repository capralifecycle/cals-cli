.PHONY: all
all: build

.PHONY: build
build: clean
	npm install
	./scripts/build-and-verify.sh
	npm run lint
	npm run prepare
	npm run test

.PHONY: test
test:
	npm run test

.PHONY: lint
lint:
	npm run lint

.PHONY: lint-fix
lint-fix:
	npm run lint:fix

.PHONY: format
format:
	npm run prettier

.PHONY: clean
clean:
	rm -rf lib coverage
