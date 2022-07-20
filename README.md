# Mocha-Pod

Run your [Mocha](https://mochajs.org/) integration tests inside a docker container.

This ensures that anyone running the tests will have the same experience, no matter the development machine. It makes use of [Mocha fixtures](https://mochajs.org/#global-fixtures)
and [root hooks](https://mochajs.org/#root-hook-plugins) to setup the environment and reset between each test.

- Simple setup. Use [.mochapod.js](#Configuration) for extra configuration.
- CI compatibility
- Additional filesystem utilities to setup/destroy the test environment.

## Requirements

- Docker

## Usage

Add `--require @balena/mocha-pod` to the mocha command to ensure Mocha-Pod test [fixtures](https://mochajs.org/#global-fixtures) are ran correctly.

```
mocha --require @balena/mocha-pod test/test.spec.js
```

## Configuration

## CI integration

When running tests inside a CI environment. Make sure the `MOCHA_POD_IS_CI` environment variable is set to true
to prevent mocha pod from trying to build a new image.
