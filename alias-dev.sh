# Source this file:
# $ source alias-dev.sh
#
# Then you can run the cli by only writing:
# $ cals

alias cals="$PWD/node_modules/.bin/ts-node --project $PWD/tsconfig.json $PWD/src/cals-cli.ts"
