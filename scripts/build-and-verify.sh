#!/bin/sh
set -eux

npm run build

echo "Testing CLI"
node lib/cals-cli.js --help
