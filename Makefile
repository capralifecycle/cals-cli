.PHONY: all
all: build

.PHONY: build
build:
	npm install
	npm run lint
	npm run prepare
	npm run test
