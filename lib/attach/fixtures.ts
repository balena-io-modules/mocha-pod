import { build, resolve as Resolve } from '@balena/compose';
import dockerIgnore from '@balena/dockerignore';
import * as Docker from 'dockerode';
import { promises as fs } from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { Readable, PassThrough } from 'stream';
import * as tar from 'tar-stream';

import logger from '../logger';

import { MochaPodConfig } from '../config';

const { Builder } = build;

/**
 * Read dockerignore from the basedir and return
 * an instance of an Ignore object with some sensible defaults
 * added
 */
async function getDockerIgnoreInstance(dir: string, defaults: string[] = []) {
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
		.add(ignoreEntries);
}

/**
 * Create a tar stream from the base directory excluding those files
 * where `allowed(file)` is false.
 */
async function tarDirectory(
	basedir: string,
	allowed: (somePath: string) => boolean,
): Promise<Readable> {
	const pack = tar.pack();

	const addFromDir = async (dir: string) => {
		const entries = await fs.readdir(dir);
		for (const entry of entries) {
			const newPath = path.resolve(dir, entry);
			// Here we filter the things we don't want
			if (!allowed(newPath)) {
				continue;
			}
			// We use lstat here, otherwise an error will be
			// thrown on a symbolic link
			const stat = await fs.lstat(newPath);
			if (stat.isDirectory()) {
				await addFromDir(newPath);
			} else {
				pack.entry(
					{
						name: path.relative(basedir, newPath),
						mode: stat.mode,
						size: stat.size,
					},
					await fs.readFile(newPath),
				);
			}
		}
	};

	// Start recursing through the directory tree
	await addFromDir(basedir);

	// Finalize the stream
	pack.finalize();

	return pack;
}

// Source: https://github.com/balena-io/balena-cli/blob/f6d668684a6f5ea8102a964ca1942b242eaa7ae2/lib/utils/device/live.ts#L539-L547
function extractDockerArrowMessage(outputLine: string): string | undefined {
	const arrowTest = /^.*\s*-+>\s*(.+)/i;
	const match = arrowTest.exec(outputLine);
	if (match != null) {
		return match[1];
	}
}

// Source: https://github.com/balena-io/balena-cli/blob/f6d668684a6f5ea8102a964ca1942b242eaa7ae2/lib/utils/device/live.ts#L300-L325
function getMultiStateImageIDs(buildLog: string): string[] {
	const ids = [] as string[];
	const lines = buildLog.split(/\r?\n/);
	let lastArrowMessage: string | undefined;
	for (const line of lines) {
		// If this was a from line, take the last found
		// image id and save it
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
	}

	return ids;
}

/**
 * This is the global fixture that mocha runs
 * before launching the test suite. All the setup for mocha-docker happens here.
 */
export async function mochaGlobalSetup() {
	const config = await MochaPodConfig();

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
	const ig = await getDockerIgnoreInstance(config.basedir, config.dockerIgnore);
	const tarStream = await tarDirectory(config.basedir, ig.createFilter());

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
	const cachePath = path.join(config.basedir, '.cache', 'mochapod-cache.json');
	const cache = await fs
		.readFile(cachePath, 'utf8')
		.then((c) => JSON.parse(c))
		.catch((e) => {
			logger.debug(`Failed to read cache: ${e.message}`);
			return [];
		});

	// Build the image ad get intermediate images from build.
	// Necessary for multi stage caching
	const { image, buildLog } = await new Promise((resolve) => {
		// Prepare to store the build logs
		const chunks = [] as Buffer[];
		const buildLogStream = new PassThrough();
		buildLogStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

		const hooks = {
			buildStream: (input: NodeJS.ReadWriteStream): void => {
				logger.info(`Starting image build`);

				// Send the tar stream to the docker daemon
				outputStream.pipe(input);

				// Pipe the output to memory
				outputStream.pipe(buildLogStream);

				// Pipe the build output to the logger
				readline.createInterface({ input }).on('line', logger.info);
			},
			buildSuccess: (imageId: string): void => {
				logger.info(`Successful build! ImageId: ${imageId}`);
				resolve({
					image: imageId,
					buildLog: Buffer.concat(chunks).toString('utf8'),
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
				cachefrom: [
					config.dockerBuildOpts.t ?? `${config.projectName}:testing`,
					...(config.dockerBuildOpts.cachefrom ?? []),
					...cache,
				],
			},
			hooks,
			logger.error,
		);
	});

	const stageIds = getMultiStateImageIDs(buildLog);

	// If this is a multi stage build, skip the cache
	if (stageIds.length > 0) {
		// Create cache dir if it doesn't exist. Ignore any errors
		await fs
			.mkdir(path.dirname(cachePath), { recursive: false })
			.catch((e) =>
				logger.debug(
					`Could not create cache directory ${path.dirname(cachePath)}: ${
						e.message
					}`,
				),
			);

		// Write stage ids as cache for next build. Ignore any errors
		await fs
			.writeFile(cachePath, JSON.stringify(stageIds))
			.catch((e) => logger.debug(`Could not write cache: ${e.message}`));
	}

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
