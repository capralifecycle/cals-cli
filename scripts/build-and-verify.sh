#!/bin/sh
set -eux

npm run build

echo "Testing CLI"
node lib/cals-cli.js --help

# Check that typing is in place.
if ! [ -e lib/index.d.ts ]; then
  echo "lib/index.d.ts missing"
  exit 1
fi
