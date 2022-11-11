import { promises as fs } from 'fs';
import * as YAML from 'js-yaml';
import * as path from 'path';
import logger from './logger';

import * as TestFs from './testfs';

import { exec as execSync } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execSync);

export type Config = {
	/**
	 * Base directory where configuration files are looked for.
	 * If a relative path is used, it is asumed to be relative to `process.cwd()`.
	 *
	 * @defaultValue `process.cwd()`
	 */
	basedir: string;

	/**
	 * Log namespaces to enable. This can also be controlled via the `DEBUG`
	 * env var.
	 *
	 * See https://github.com/debug-js/debug
	 * @defaultValue `'mocha-pod,mocha-pod:error'`
	 */
	logging: string;

	/**
	 * Only perform the build step during the global mocha setup. If set to false
	 * this will run `npm run test` inside a container after the build.
	 *
	 * @defaultValue `false`
	 */
	buildOnly: boolean;

	/**
	 * IP address or URL for the docker host. If no protocol is included, the protocol
	 * is assumed to be `tcp://`
	 * e.g.
	 * - `tcp://192.168.1.105`
	 * - `unix:///var/run/docker.sock`
	 *
	 * The configuration value can be overriden by setting the `DOCKER_HOST` environment
	 * variable.
	 *
	 * @defaultValue `unix:///var/run/docker.sock`
	 */
	dockerHost: string;

	/**
	 * List of default dockerignore directives. These are overriden if a `.dockerignore` file is
	 * defined at the project root.
	 *
	 * NOTE: `*\/*\//.git` is always ignored
	 *
	 * @defaultValue `['!*\/*\//Dockerfile', '!*\/*\//Dockerfile.*\/', '*\/*\//node_modules', '*\/*\//build', '*\/*\//coverage' ]`
	 */
	dockerIgnore: string[];

	/**
	 * Extra options to pass to the image build.
	 * See https://docs.docker.com/engine/api/v1.41/#tag/Image/operation/ImageBuild
	 *
	 * @defaultValue `{
	 *   buildArgs: {
	 *   		NODE_VERSION // the host environment node version
	 * 			NODE_VERSION_MAJOR // the host environment major node version
	 * 			BALENA_ARCH // the host architecture or the configuration value set by the user
	 * 			BALENA_MACHINE_NAME // the machine name as set by the user or inferred from the architecture
	 *   }
	 * }`
	 */
	dockerBuildOpts: { [key: string]: any };

	/**
	 * The architecture of the system where the images will be
	 * built and ran. This is used to replace `%%BALENA_ARCH%%` in
	 * [Dockerfile.template](https://www.balena.io/docs/reference/base-images/base-images/#how-the-image-naming-scheme-works)
	 *
	 * The architecture is detected automatically using `uname`, set this value if building
	 * on a device other than the local machine.
	 *
	 * Supported values: `'amd64' | 'aarch64' | 'armv7hf' | 'i386' | 'rpi'`
	 *
	 * @defaultValue inferred from `process.arch`
	 */
	deviceArch: string;

	/**
	 * The device type of the system where the images will be built an ran.
	 * This is used to replace `%%BALENA_MACHINE_NAME%%` in
	 * [Dockerfile.template](https://www.balena.io/docs/reference/base-images/base-images/#how-the-image-naming-scheme-works)
	 * given.
	 *
	 * The device type is inferred automatically from the device architecture, set this value if building
	 * on a device other than the local machine.
	 */
	deviceType: string;

	/**
	 * Name of the project where mocha-pod is being ran on.
	 * By default it will get the name from `package.json` at `basedir`, if it does
	 * not exist, it will use `mocha-pod-testing`
	 */
	projectName: string;

	/**
	 * Test command to use when running tests within a container. This will only be used
	 * if `buildOnly` is set to `false`.
	 *
	 * @defaultValue `["npm", "run", "test"]`
	 */
	testCommand: string[];

	/**
	 * TestFs configuration to be set by the `beforeAll` mocha-pod hook.
	 *
	 * @defaultValue `{}`
	 */
	testfs: Partial<Omit<TestFs.Config, 'basedir'>>;

	// Leave the type open so additional keys can be set
	[key: string]: any;
};

/**
 * Get a representative device type from the given architecture
 */
function inferDeviceTypeFormArch(cpuArch: Config['deviceArch']) {
	switch (cpuArch) {
		case 'amd64':
			return 'genericx86-64-ext';
		case 'aarch64':
			return 'generic-aarch64';
		case 'armv7hf':
			return 'raspberrypi3';
		case 'i386':
			return 'qemux86';
		case 'rpi':
			return 'raspberry-pi';
		default:
			logger.debug(
				`Could not infer device type from architecture: '${cpuArch}'`,
			);
			return 'unknown';
	}
}

async function arch() {
	const uname = await exec('uname -m').catch((e) => {
		throw new Error(`Failed to detect processor architecture: ${e.message}.`);
	});

	const cpuArch = uname.stdout.trim();
	switch (cpuArch) {
		case 'aarch64':
		case 'amd64':
			return 'aarch64';
		case 'x86_64':
			return 'amd64';
		case 'armv7l':
			return 'armv7hf';
		case 'armv6l':
			return 'rpi';
		case 'i686':
		case 'i386':
			return 'i386';
		default:
			logger.debug(`Unknown architecture: '${cpuArch}'`);
			return cpuArch;
	}
}

const MOCHAPOD_CONFIG =
	process.env.MOCHAPOD_CONFIG ?? path.join(process.cwd(), '.mochapodrc.yml');
const DEFAULTS: Config = {
	basedir: process.cwd(),
	logging: 'mocha-pod,mocha-pod:error',
	dockerHost: 'unix:///var/run/docker.sock',
	dockerIgnore: [
		'!**/Dockerfile',
		'!**/Dockerfile.*',
		'**/node_modules',
		'**/build',
		'**/coverage',
	],
	dockerBuildOpts: {},
	deviceArch: 'amd64',
	deviceType: inferDeviceTypeFormArch('amd64'),
	projectName: 'mocha-pod',
	buildOnly: false,
	testCommand: ['npm', 'run', 'test'],
	testfs: {},
};

function toAbsolute(dir: string, basedir = DEFAULTS.basedir) {
	if (path.isAbsolute(dir)) {
		return dir;
	}
	return path.join(basedir, dir);
}

function slugify(text: string) {
	return text
		.toString() // Cast to string (optional)
		.normalize('NFKD') // The normalize() using NFKD method returns the Unicode Normalization Form of a given string.
		.toLowerCase() // Convert the string to lowercase letters
		.replace(/[^\w\-]+/g, ' ') // Replace all non-word chars with ' '
		.trim() // Remove whitespace from both sides of a string (optional)
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

/**
 * Loads a mocha-pod configuration from the given source file and
 * overrides the default values
 *
 * @param overrides - additional overrides. These take precedence over `.mochapodrc.yml`
 * @param source    - full path to look for the configuration file. @defaultValue `path.join(process.cwd(), '.mochapodrc.yml')`
 * @returns         - updated mocha pod config including user overrides.
 */
export async function Config(
	overrides: Partial<Config> = {},
	source = MOCHAPOD_CONFIG,
): Promise<Config> {
	const userconf = await fs
		.readFile(source, 'utf8')
		.then((contents) => YAML.load(contents) as Partial<Config>)
		.catch((e) => {
			if (e.code !== 'ENOENT') {
				throw new Error(
					`Error reading configuration from ${source}: ${e.message}`,
				);
			}
			return {} as Partial<Config>;
		});

	// Set log levels
	logger.enable(
		// Append value of DEBUG env var if any
		[
			userconf.logging ?? overrides.logging ?? DEFAULTS.logging,
			process.env.DEBUG,
		]
			.filter((s) => !!s)
			.join(','),
	);

	// Deduce the name from package.json
	const dir = toAbsolute(overrides.basedir ?? DEFAULTS.basedir);
	const projectName =
		userconf.projectName ??
		(await fs
			.readFile(path.join(dir, 'package.json'), 'utf8')
			.then((contents) => JSON.parse(contents))
			.then((obj: any) => slugify(obj?.name) ?? DEFAULTS.projectName)
			.catch(() => DEFAULTS.projectName));

	const deviceArch =
		userconf.deviceArch ?? overrides.deviceArch ?? (await arch());

	// Get the merged configuration
	const conf = {
		...DEFAULTS,
		projectName,
		...userconf,
		...overrides,
		deviceArch,
	};

	// Infer the device type one more time if the user has changed it
	const deviceType = inferDeviceTypeFormArch(conf.deviceArch);

	// Add extra variables to build args
	const buildArgs = {
		NODE_VERSION: process.versions.node,
		NODE_VERSION_MAJOR: process.versions.node.split('.').shift(),
		BALENA_ARCH: deviceArch,
		BALENA_MACHINE_NAME: deviceType,
	};

	// Allow overriding the configured docker host using an env var
	const dockerHost = process.env.DOCKER_HOST ?? conf.dockerHost;

	// Use absolute path for the basedir
	return {
		...conf,
		basedir: toAbsolute(conf.basedir),
		deviceType,
		dockerHost,
		dockerBuildOpts: {
			...conf.dockerBuildOpts,
			buildArgs: { buildArgs, ...conf.dockerBuildOpts.buildArgs },
		},
	};
}

export default Config;
