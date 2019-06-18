# Build image.

FROM node:11-alpine

# Needed for `npm install keytar`
RUN apk add --no-cache \
      g++ \
      git \
      libsecret-dev \
      make \
      python
