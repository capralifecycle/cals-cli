# cals-cli

## Getting started

Make sure you have a recent version of node. E.g. by following
https://github.com/creationix/nvm

Clone this repo.

Use NPM to link this repo as a global package:

```bash
npm install
npm link
```

Run the cli from any folder (as it is linked by NPM it will also
work in other terminals):

```bash
cals
```

### Updating

The `npm link` command will also build the application. When
changing the code, a rebuild must be done.

```bash
git pull
npm run build
```

### Development

Source the version that uses the source files directly.

```bash
source alias-dev.sh
```

Run the cli:

```bash
cals
```

This is slower than using the build with `npm link` due to running
through the TypeScript compiler.

## Goals of CLI

* Provide an uniform way of consistently doing repeatable CALS tasks
* Provide simple guidelines to improve the experience for developers
* A tool that everybody uses and gets ownership of
* Automate repeatable CALS tasks as we go

## Ideas and future work

* Release as package on NPM
* Automate onboarding of people
  * Granting access to various resources: AWS, GitHub, Confluence, JIRA, Slack, ...
* Automate offboarding of people
* Automate generation of new projects/resources
  * Creating GitHub repos, giving permissions etc
  * Slack channels
  * AWS account and structure
  * Checklist for manual processes
* AWS infrastructure management, e.g. scripts such as https://github.com/capralifecycle/rvr-aws-infrastructure/blob/master/rvr/create-stack.sh
  * `cals aws ...`
