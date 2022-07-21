# Mocha-Pod

Run your [mocha](https://mochajs.org/) tests using docker.

Mocha-Pod is a mocha plugin that takes over your `npm run test`, and runs your test suite using docker.

This ensures that anyone running the tests will have the same experience, no matter the development machine or if the tests are being
ran as part of a CI build. Mocha-Pod also provides utilities to work with test configuration files and ensures the filesystem state
is reset after each test.

- Easy setup. Just add `-r mocha-pod/attach` to your mocha command. It will use some sensible configuration defaults.
- Fully configurable through a [.mochapod.yml](#Configuration) at the root of your project.
- CI compatible. Add `MOCHAPOD_SKIP_SETUP` to ensure the image build is skipped when running inside a CI system.
- Additional filesystem utilities to setup/destroy the test environment (**TODO**).

## Requirements

- [Mocha](https://mochajs.org/)
- Local or remote docker socket.

## Usage

Add `mocha-pod` as a development dependency to your `package.json`.

```
npm i --save-dev mocha-pod
```

Add `-r mocha-pod/attach` to your mocha command inside your `package.json`.

Example:

```
// inside package.json
"scripts": {
  "test": "mocha -r mocha-pod/attach --reporter spec test/**/*.spec.js"
}
```

Or with typescript and [ts-node](https://www.npmjs.com/package/ts-node).

```
// inside package.json
"scripts": {
	"test": "mocha -r ts-node/register -r lib/attach --reporter spec tests/**/*.spec.ts",
}
```

## How does it work

Mocha-Pod makes use of [mocha fixtures](https://mochajs.org/#global-fixtures) to first setup the environment. During this process
the plugin will look for a `Dockerfile` (or [Dockerfile.template](https://www.balena.io/docs/learn/develop/dockerfile/#dockerfile-templates)) at the root directory
of your project and will build an image using the directory contents. Any directives specified
in `.dockerignore` will be respected and additional [build configurations](https://docs.docker.com/engine/api/v1.41/#tag/Image/operation/ImageBuild) can be added
under `dockerBuildOpts` in the Mocha-Pod configuration file.

After the build, the plugin will run a container passing `npm run test` as the [command](https://docs.docker.com/engine/reference/commandline/run/)
and passing `MOCHAPOD_SKIP_SETUP=1` as an env var.

At this point a separate test process will be lauched, the plugin will run again, this time skipping the
build step, and [mocha root hooks](https://mochajs.org/#root-hook-plugins) will be ran before and after each test. These hooks will
ensure the filesystem is reset to the initial condition (when the image was built).

If you need more control over how the tests are ran, you may chose to skip the container step and call
`npm run test` directly inside your image build process. Make sure you set `buildOnly: true` in the configuration file,
and set the `MOCHAPOD_SKIP_SETUP=1` during this step (see our [Dockerfile](./Dockerfile) for an example).

## Examples

This repository uses the Mocha-Pod plugin to run its own tests (**TODO**)

## Configuration

See [lib/config.ts](lib/config.ts) for the full list of configuration options.

## CI integration

When running tests inside a CI environment. Make sure the `MOCHAPOD_SKIP_SETUP` environment variable is set to `true`
to prevent mocha pod from running the setup and going straight to running the tests.
