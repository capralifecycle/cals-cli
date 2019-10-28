# Build image.

FROM node:12-alpine

# Needed for `npm install keytar`
RUN apk add --no-cache \
      g++ \
      git \
      libsecret-dev \
      make \
      python

# Needed to analyze to SonarCloud
RUN set -ex; \
    wget https://raw.githubusercontent.com/capralifecycle/buildtools-snippets/master/tools/sonar-scanner/install.sh -O- | sh; \
    sonar-scanner --version
