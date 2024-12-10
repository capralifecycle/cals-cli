.PHONY: all
all: build

.PHONY: build
build: clean
	npm install
	./scripts/build-and-verify.sh
	npm run lint
	npm run prepare
	npm run test

.PHONY: clean
clean:
	rm -rf lib
