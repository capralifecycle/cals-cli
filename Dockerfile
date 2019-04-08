# Build image.

FROM node:11-alpine

# Needed for `npm install keytar`
RUN apk add --no-cache \
      libsecret-dev \
      python \
      make \
      g++
