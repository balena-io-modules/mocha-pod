import { promises as fs } from 'fs';
import * as YAML from 'js-yaml';
import * as path from 'path';

export type MochaPodConfig = {
	/**
	 * Base directory where configuration files are looked for
	 * Defauts to `process.cwd()`
	 *
	 * If a relative path is used, it is asumed to be relative to `process.cwd()`.
	 */
	basedir: string;

	/**
	 * Log namespaces to enable. This can also be controlled via the `DEBUG`
	 * env var.
	 *
	 * Defaults to 'mocha-pod,mocha-pod:error'
	 *
	 * See: https://github.com/debug-js/debug
	 */
	logging: string;

	/**
	 * Only perform the build step during the global mocha setup. If set to false
	 * this will run `npm run test` inside a container after the build.
	 *
	 * Defaults to `false`
	 */
	buildOnly: boolean;

	/**
	 * IP address or URL for the docker host. If no protocol is included, the protocol
	 * is assumed to be `tcp://`
	 * e.g.
	 * - `tcp://192.168.1.105`
	 * - `unix:///var/run/docker.sock`
	 *
	 * It defaults to unix:///var/run/docker.sock
	 */
	dockerHost: string;

	/**
	 * List of default dockerignore directives. These are overriden if a `.dockerignore` file is
	 * defined at the project root.
	 *
	 * Defaults to:
	 * `['!*\/*\//Dockerfile', '!*\/*\//Dockerfile.*\/', '*\/*\//node_modules', '*\/*\//build', '*\/*\//coverage' ]`
	 *
	 * NOTE: `*\/*\//.git` is always ignored
	 */
	dockerIgnore: string[];

	/**
	 * Extra options to pass to the image build
	 *
	 * See: https://docs.docker.com/engine/api/v1.41/#tag/Image/operation/ImageBuild
	 *
	 * Defaults to `{}`
	 * '
	 */
	dockerBuildOpts: { [key: string]: any };

	/**
	 * The architecture of the system where the images will be
	 * built and ran. Defaults to 'amd64'
	 */
	deviceArch: 'amd64' | 'aarch64' | 'armv7hf' | 'i386' | 'rpi';

	/**
	 * Device type. Used for replacing `%%BALENA_MACHINE_NAME%%` in Dockerfile.template if
	 * given.
	 *
	 * It is inferred from the deviceArch if none are set.
	 */
	deviceType: string;

	/**
	 * Name of the project where mocha-pod is being ran on
	 *
	 * By default it will get the name from `package.json` at `basedir`, if it does
	 * not exist, it will use `mocha-pod-testing`
	 */
	projectName: string;

	/**
	 * Test command to use when running tests within a container. This will only be used
	 * if `buildOnly` is set to `false`.
	 *
	 * Defaults to `["npm", "run", "test"]`
	 */
	testCommand: string[];

	// Leave the type open so additional keys can be set
	[key: string]: any;
};

/**
 * Get a representative device type from the given architecture
 */
function inferDeviceTypeFormArch(arch: MochaPodConfig['deviceArch']) {
	switch (arch) {
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
			// This will only happen due to user error
			throw new Error(`Unknown architecture: ${arch}`);
	}
}

const MOCHAPOD_CONFIG =
	process.env.MOCHAPOD_CONFIG ?? path.join(process.cwd(), '.mochapodrc.yml');
const DEFAULTS: MochaPodConfig = {
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

export async function Config(
	overrides: Partial<MochaPodConfig> = {},
	source = MOCHAPOD_CONFIG,
) {
	const userconf = await fs
		.readFile(source, 'utf8')
		.then((contents) => YAML.load(contents) as Partial<MochaPodConfig>)
		.catch((e) => {
			if (e.code !== 'ENOENT') {
				throw new Error(
					`Error reading configuration from ${source}: ${e.message}`,
				);
			}
			return {} as Partial<MochaPodConfig>;
		});

	// Deduce the name from package.json
	const dir = toAbsolute(overrides.basedir ?? DEFAULTS.basedir);
	const projectName =
		userconf.projectName ??
		(await fs
			.readFile(path.join(dir, 'package.json'), 'utf8')
			.then((contents) => JSON.parse(contents))
			.then((obj: any) => slugify(obj?.name) ?? DEFAULTS.projectName)
			.catch(() => DEFAULTS.projectName));

	// Get the merged configuration
	const conf = {
		...DEFAULTS,
		projectName,
		...userconf,
		...overrides,
	};

	// Infer the device type one more time if the user has changed it
	const deviceType = inferDeviceTypeFormArch(conf.deviceArch);

	// Use absolute path for the basedir
	return { ...conf, basedir: toAbsolute(conf.basedir), deviceType };
}

export default Config;
