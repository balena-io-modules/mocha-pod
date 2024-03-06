import { build, resolve as Resolve } from '@balena/compose';
import dockerIgnore from '@balena/dockerignore';
import Docker from 'dockerode';
import { promises as fs } from 'fs';
import readline from 'readline';
import path from 'path';
import * as tar from 'tar-fs';

import logger from '../logger';

import { Config } from '../config';

const { Builder } = build;

/**
 * Read dockerignore from the basedir and return
 * an instance of an Ignore object with some sensible defaults
 * added
 */
async function allowedFromDockerIgnore(dir: string, defaults: string[] = []) {
	const ignorePath = path.join(dir, '.dockerignore');
	const ignoreEntries = await fs
		.readFile(ignorePath, 'utf8')
		.then((contents) => contents.split(/\r?\n/))
		.catch((e) => {
			if (e.code !== 'ENOENT') {
				throw new Error(`Error reading file ${ignorePath}: ${e.message}`);
			}
			return defaults;
		});

	return dockerIgnore({ ignorecase: false })
		.add(['**/.git']) // Always ignore .git directories
		.add(ignoreEntries)
		.createFilter();
}

// Source: https://github.com/balena-io/balena-cli/blob/f6d668684a6f5ea8102a964ca1942b242eaa7ae2/lib/utils/device/live.ts#L539-L547
function extractDockerArrowMessage(outputLine: string): string | undefined {
	const arrowTest = /^.*\s*-+>\s*(.+)/i;
	const match = arrowTest.exec(outputLine);
	if (match != null) {
		return match[1];
	}
}

async function writeCache(stageIds: string[], cachePath: string) {
	if (stageIds.length > 0) {
		logger.info(`Caching successful stage build ids in '${cachePath}'`);
		logger.debug('Stage ids', stageIds);
		// Create cache dir if it doesn't exist. Ignore any errors
		await fs.mkdir(path.dirname(cachePath), { recursive: true }).catch(() => {
			/** ignore */
		});

		// Write stage ids as cache for next build. Ignore any errors
		await fs
			.writeFile(cachePath, JSON.stringify(stageIds))
			.catch((e) => logger.debug(`Could not write cache: ${e.message}`));
	}
}

/**
 * This is the global fixture that mocha runs
 * before launching the test suite. All the setup for mocha-docker happens here.
 */
export async function mochaGlobalSetup() {
	const config = await Config();

	// If the build is happening on a CI, skip this step
	if (['1', 'true'].includes(process.env.MOCHAPOD_SKIP_SETUP ?? '0')) {
		logger.debug('Skipping setup');
		return;
	}

	logger.info('Setting up');
	logger.debug('Using Config', JSON.stringify(config, null, 2));

	// Get a new docker instance
	const docker = (() => {
		const url = new URL(config.dockerHost);
		if (url.protocol === 'unix:') {
			return new Docker({ socketPath: url.pathname });
		}
		return new Docker({ host: config.dockerHost });
	})();

	const builder = Builder.fromDockerode(docker);

	// Create the tar archive
	const allowed = await allowedFromDockerIgnore(
		config.basedir,
		config.dockerIgnore,
	);

	const tarStream = tar.pack(config.basedir, {
		ignore: (name) => !allowed(name),
	});

	const bundle = new Resolve.Bundle(
		tarStream,
		config.deviceType,
		config.deviceArch,
	);

	// Resolve Dockerfile.template if it exists
	const outputStream = Resolve.resolveInput(
		bundle,
		Resolve.getDefaultResolvers(),
		{},
	);

	// Try to load cache. Ignore errors
	const cachePath = path.join(config.basedir, '.cache', 'mochapod.json');
	const cache = await fs
		.readFile(cachePath, 'utf8')
		.then((c) => JSON.parse(c))
		.catch((e) => {
			logger.debug(`Failed to read cache: ${e.message}`);
			return [];
		});

	// Build the image ad get intermediate images from build.
	// Necessary for multi stage caching
	const { image, stageIds } = await new Promise<{
		image: string;
		stageIds: string[];
	}>((resolve) => {
		// Store the stage ids for caching
		const ids = [] as string[];

		const hooks = {
			buildStream: (input: NodeJS.ReadWriteStream): void => {
				logger.info(`Starting image build`);

				// Send the tar stream to the docker daemon
				outputStream.pipe(input);

				// Parse the build output to get stage ids and
				// for logging
				let lastArrowMessage: string | undefined;
				readline.createInterface({ input }).on('line', (line) => {
					// If this was a FROM line, take the last found
					// image id and save it as a stage id
					// Source: https://github.com/balena-io/balena-cli/blob/f6d668684a6f5ea8102a964ca1942b242eaa7ae2/lib/utils/device/live.ts#L300-L325
					if (
						/step \d+(?:\/\d+)?\s*:\s*FROM/i.test(line) &&
						lastArrowMessage != null
					) {
						ids.push(lastArrowMessage);
					} else {
						const msg = extractDockerArrowMessage(line);
						if (msg != null) {
							lastArrowMessage = msg;
						}
					}

					// Log the build line
					logger.info(line);
				});
			},
			buildSuccess: (imageId: string): void => {
				logger.info(`Successful build! ImageId: ${imageId}`);
				resolve({
					image: imageId,
					stageIds: ids.concat([imageId]),
				});
			},
			buildFailure: (error: Error): void => {
				logger.error('Build failed!:', error.message);
				process.exit(1);
			},
		};

		return builder.createBuildStream(
			{
				// Use the project name as part of the image name
				t: `${config.projectName}:testing`,
				...config.dockerBuildOpts,
				cachefrom: [...(config.dockerBuildOpts.cachefrom ?? []), ...cache],
			},
			hooks,
			logger.error,
		);
	});

	// Write the cache
	await writeCache(stageIds, cachePath);

	// If build only is set, we assume that the tests were ran within
	// the image build and exit successfully. In that scenarion, if the tests failed, the build
	// will fail before this step.
	if (config.buildOnly) {
		process.exit(0);
	}

	// Try to start the container
	logger.info('Running test suite inside a new container');
	const [output] = await docker.run(image, config.testCommand, process.stdout, {
		Env: ['MOCHAPOD_SKIP_SETUP=1'], // Skip the setup when running inside the container
		HostConfig: { AutoRemove: true },
	});

	// Tests are run in the container, exit the process before mocha can
	// run the local tests
	process.exit(output?.StatusCode ?? -1);
}
