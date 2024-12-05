.PHONY: all
all: build

.PHONY: build
build:
	npm install
	./scripts/build-and-verify.sh
	npm run lint
	npm run prepare
	npm run test
