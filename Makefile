.PHONY: all
all: build

.PHONY: build
build: clean install lint-fix prepare build-cli test

.PHONY: ci
ci: install lint prepare build-cli test

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

.PHONY: format
format:
	npm run prettier

.PHONY: clean
clean:
	rm -rf lib coverage

.PHONY: clean-all
clean-all: clean
	rm -rf node_modules

.PHONY: upgrade-deps
upgrade-deps:
	npm run upgrade-deps
