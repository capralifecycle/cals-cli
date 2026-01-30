.PHONY: all
all: build

.PHONY: build
build: clean install fmt lint-fix prepare build-cli test

.PHONY: ci
ci: install fmt-check lint prepare build-cli test

.PHONY: install
install:
ifeq ($(CI),true)
	npm ci
else
	npm install
endif

.PHONY: build-cli
build-cli:
	./scripts/build-and-verify.sh

.PHONY: test
test:
	npm run test

.PHONY: lint
lint:
	npm run lint

.PHONY: prepare
prepare:
	npm run prepare

.PHONY: lint-fix
lint-fix:
	npm run lint:fix

.PHONY: fmt
fmt:
	npm run format

.PHONY: fmt-check
fmt-check:
	npm run format:check

.PHONY: clean
clean:
	rm -rf lib coverage

.PHONY: clean-all
clean-all: clean
	rm -rf node_modules

.PHONY: upgrade-deps
upgrade-deps:
	npm run upgrade-deps

# Manual test targets (requires CALS_GITHUB_TOKEN env var)
.PHONY: test-repos
test-repos:
	CALS_GITHUB_TOKEN=$(CALS_GITHUB_TOKEN) node lib/cals-cli.mjs repos --org capralifecycle --compact

.PHONY: test-clone
test-clone:
	CALS_GITHUB_TOKEN=$(CALS_GITHUB_TOKEN) node lib/cals-cli.mjs clone --org capralifecycle --all | head -5

.PHONY: test-help
test-help:
	node lib/cals-cli.mjs --help
