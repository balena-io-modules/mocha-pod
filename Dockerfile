ARG NODE_VERSION_MAJOR=20

FROM node:${NODE_VERSION_MAJOR}-alpine AS build

WORKDIR /usr/src/app

COPY package.json ./

# Setup dependencies
RUN npm install

# Copy all files necessary for running the tests to the
# test stage
COPY tsconfig.json ./
COPY tsconfig.release.json ./
COPY lib ./lib

# Include the test directory in this stage
COPY tests ./tests

# Do not forget to copy mocha-pod config
COPY .mochapodrc.yml ./

# Set the environment variable globally to use
# this image for development of mocha-pod
ENV MOCHAPOD_SKIP_SETUP=1

FROM build AS testing

# Comment the next line if you want to run the tests as a separate
# container instead of during the image build step.
# Make sure you also have set the  `buildOnly` to `false` inside
# .mochapodrc.yml
RUN MOCHAPOD_SKIP_SETUP=1 npm run test:integration

# Test everything else for the CI tests
FROM testing AS ci

RUN npm run test:unit && npm run build && npm run lint
