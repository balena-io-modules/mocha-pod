FROM node:16-alpine as build

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

CMD npm run test:integration
