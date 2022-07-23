FROM node:alpine

WORKDIR /usr/src/app

COPY package.json ./

# Setup dependencies
RUN npm install

# Copy all files necessary for running the tests to the
# test stage
COPY tsconfig.json ./
COPY lib ./lib

# Include the test directory in this stage
COPY tests ./tests

# Do not forget to copy mocha-pod config
COPY .mochapodrc.yml ./

# Comment the next line if you want to run the tests as a separate
# container instead of during the image build step.
# Make sure you also have set the  `buildOnly` to `false` inside
# .mochapodrc.yml
RUN MOCHAPOD_SKIP_SETUP=1 npm run test