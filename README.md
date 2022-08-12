# Mocha-Pod

Run your integration tests using [mocha](https://mochajs.org/) and docker.

Mocha-Pod is a mocha plugin that takes over your `npm run test` execution, and runs your test suite within a docker container or docker build process.

This ensures that anyone running the tests will have the same experience, no matter the development machine or if the tests are being
ran as part of a CI build. Mocha-Pod also provides utilities to work with the filesystem, and ensure the state is reset between tests.

- Easy setup. Just add `-r mocha-pod/attach` to your mocha command. It will use some sensible [configuration defaults](docs/modules/MochaPod.md).
- Additional [filesystem utilities to setup/destroy](#working-with-the-filesystem) the test environment.

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
build step, and [mocha root hooks](https://mochajs.org/#root-hook-plugins) will be ran before and after the test suite is executed. These hooks will that the right configurations are loaded and the the filesystem is reset to the initial condition (before the test).

If you need more control over how the tests are ran, you may chose to skip the container step and call
`npm run test` directly inside your image build process. Make sure you set `buildOnly: true` in the configuration file,
and set the `MOCHAPOD_SKIP_SETUP=1` during this step (see our [Dockerfile](./Dockerfile) for an example).

## Working with the filesystem

MochaPod also includes the [testfs](docs/modules.md#testfs) utility to interact with the container
filesystem in order to be able to make changes and restore betweent tests. To use the module, import it into your
test suite as follows

```typescript
import { testfs } from 'mocha-pod';
```

For example, the following prepares the filesystem with a new configuration under `/etc/test.conf`

```typescript
// Prepare a new test fs. The /etc/test.conf file will be created
const tmp = await testfs({ '/etc/test.conf': 'logging=true' }).enable();

// The file should be available after setup
expect(await fs.readFile('/etc/test.conf', 'utf-8')).to.equal('logging=true');

// RUN YOUR TESTS HERE

// Restore the filesystem
// Since test.conf did not exist before the enable(), this step removes
// the file
await tmp.restore();

// This should succeed
await expect(fs.access('/etc/test.conf')).to.be.rejected;
```

Using this module allows you to work with other tools outside node, for instance

```typescript
// This tells testfs to not create new files, but that the test will
// modify existing system files that should be backed up
const origHostname = await fs.readFile('/etc/hostname', 'utf-8');
const tmp = await testfs({}, { keep: ['/etc/hostname'] }).enable();

// Call a system program that modifies the file
await exec('echo -n "myhostname" > /etc/hostname');

// RUN YOUR TESTS HERE

// Restore the filesystem. This will restore the original contents of /etc/hostname
await tmp.restore();

// This will succeed
expect(await fs.readFile('/etc/hostname', 'utf-8')).to.equal(origHostname);
```

If the code you are testing creates any new temporary files, `testfs()` can handle the cleanup.

```typescript
// This tells testfs that /etc/other.conf is created during the test
const tmp = await testfs({}, { cleanup: ['/etc/other.conf'] }).enable();

// Create a file to a separate system program
await exec('echo -n "debug=1" > /etc/other.conf');

// RUN YOUR TESTS HERE

// Restore the filesystem
await tmp.restore();

// This will succeed
await expect(fs.access('/etc/other.conf')).to.be.rejected;
```

The [testfs](docs/modules/TestFs.md) module works as follows. On setup the method will prepare the filesystem for testing by performing the following
operations.

- Group the directory spec into existing/non-existing files. Existing files go into the keep list for backup and non-existing will go to the cleanup list.
- Create a backup of all files matching the keep list
- Replace all files from the directory spec into the filesystem.

On restore, the module will

- delete any files in the cleanup list
- restore the original filesystem files from the backup

Note that attempts to call `enable()` more than once will cause an exception.

**IMPORTANT** don't use this module in a real (non-containerized) system, specially with admin permissions, you risk leaving the system
in an inconsistent state if a crash happens before a `restore()` can be performed.

## CI integration

When running tests inside a CI environment. Make sure the `MOCHAPOD_SKIP_SETUP` environment variable is set to `true`
to prevent mocha pod from running the setup and going straight to running the tests.

## Configuration

Additional configurations can be defined at the root of your project by creating a `.mochapodrc.yml` file. For see our API docs for a [full list of configuration options](docs/modules/MochaPod.md).

Additionally the following environment variables can be used to modify the behavior of Mocha-Pod

| Name                | Description                                                                                                        | Default Value                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| MOCHAPOD_CONFIG     | Alternative location to look for a configuration file                                                              | `path.join(process.cwd(), '.mochapodrc.yml')` |
| MOCHAPOD_SKIP_SETUP | Use within a CI system to let Mocha-Pod to skip the setup step (that builds the image) and directly run the hooks. | 0                                             |

## Examples

This repository uses the Mocha-Pod plugin to run its own tests. See

- [Dockerfile](Dockerfile) for the image setup
- [mochapodrc.yml](.mochapodrc.yml) for the extra configuration
- [tests](./tests) for testfs usage examples.
