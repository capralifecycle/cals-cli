# cals-cli

## Getting started

Make sure you have a recent version of Node.js. E.g. by using
https://github.com/creationix/nvm

```bash
npx @capraconsulting/cals-cli --help
```

It is recommended to use `npx` over global install to ensure you
always run the latest version. If you install it globally remember
to update it before running.

## Commands

### Authentication

Set your GitHub token (will be stored in the OS keychain):

```bash
cals auth
```

### List repositories

```bash
cals repos --org capralifecycle
cals repos --org capralifecycle --compact
cals repos --org capralifecycle --csv
```

### Generate clone commands

Generate clone commands (pipe to bash to execute):

```bash
cals clone --org capralifecycle --all | bash
cals clone --org capralifecycle --group mygroup | bash
```

### Sync repositories

Pull latest changes for all repositories in a directory managed by a `.cals.yaml` manifest:

```bash
cals sync
cals sync --ask-clone  # Prompt to clone missing repos
```

## Build

Build and verify:

```sh
$ make  # or "make build"
```

## Contributing

This project uses [semantic release](https://semantic-release.gitbook.io/semantic-release/)
to automate releases and follows
[Git commit guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit)
from the Angular project.

Version numbers depend on the commit type and footers: https://github.com/semantic-release/commit-analyzer/blob/75c9c87c88772d7ded4ca9614852b42519e41931/lib/default-release-rules.js#L7-L12

## Contributing

This project doesn't currently accept contributions. For inquiries, please contact the maintainers at [Slack](https://liflig.slack.com/archives/C02T4KTPYS2).
