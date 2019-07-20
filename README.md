# cals-cli

[![Build Status](https://jenkins.capra.tv/buildStatus/icon?job=cals-internal/cals-cli/master)](https://jenkins.capra.tv/job/cals-internal/job/cals-cli/job/master/)

## Getting started

Make sure you have a recent version of Node.js. E.g. by using
https://github.com/creationix/nvm

```bash
npx @capraconsulting/cals-cli --help
```

It is recommended to use `npx` over global install to ensure you
always run the latest version. If you install it globally remember
to update it before running.

## Building locally

Clone this repo.

Use NPM to link this repo as a global package:

```bash
npm install
npm run build
npm link
```

Run the cli from any terminal/folder:

```bash
cals
```

Rebuild using `npm run build`.

## Contributing

This project uses [semantic release](https://semantic-release.gitbook.io/semantic-release/)
to automate releases and follows
[Git commit guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit)
from the Angular project.

## Goals of CLI

* Provide an uniform way of consistently doing repeatable CALS tasks
* Provide simple guidelines to improve the experience for developers
* A tool that everybody uses and gets ownership of
* Automate repeatable CALS tasks as we go

## Ideas and future work

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

### Snyk management

https://snyk.docs.apiary.io/reference/projects

* [ ] Automatically set up project in Snyk
* [x] Report of which repos are in Snyk and which is not
* [ ] Detect active vs disabled projects in Snyk (no way through API now?)
* [x] Report issues in Snyk grouped by our projects
