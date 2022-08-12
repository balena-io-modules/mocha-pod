import * as fg from 'fast-glob';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar-fs';
import logger from './logger';

import { nanoid } from 'nanoid';

import { createReadStream, createWriteStream, promises as fs } from 'fs';

/**
 * Describe a file contents and configuration
 * options.
 */
export type File = string | Buffer;

/**
 * A directory is a recursive data structure of
 * named files and directories
 */
export interface Directory {
	[key: string]: File | Directory;
}

class DirectoryIsInvalid extends Error {}

/**
 * Type guard to idenfity an object as a file
 */
const isFile = (x: unknown): x is File =>
	x != null &&
	(typeof x === 'string' || x instanceof String || Buffer.isBuffer(x));

/**
 * Type guard to identify an object as a directory
 */
const isDirectory = (x: File | Directory): x is Directory =>
	x != null && !isFile(x);

export interface TestFsOpts {
	/**
	 * Directory to use as base for the directory specification and glob search.
	 *
	 * @defaultValue `/`
	 */
	readonly rootdir: string;
	/**
	 * List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
	 * identifying any files that should be backed up prior to setting up the
	 * filesystem. Any files that will be modified during the test should go here
	 *
	 * @defaultValue `[]`
	 */
	readonly keep: string[];

	/**
	 * List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
	 * identifying  files that should be removed during the restore step.
	 * Add here any temporary files created during the test that should be cleaned up.
	 *
	 * @defaultValue `[]`
	 */
	readonly cleanup: string[];
}

export interface TestFsSet {
	/**
	 * Location of the backup file
	 */
	readonly backup: string;

	/**
	 * Restore the environment to the state before the filesystem was setup
	 */
	restore(): Promise<TestFsUnset>;
}

export interface TestFsConfig extends TestFsOpts {
	/**
	 * Additional directory specification to be passed to `testfs()`
	 *
	 * @defaultValue `{}`
	 */
	readonly filesystem: Directory;
}

export interface TestFsUnset {
	/**
	 * Setup the test environment with the provided test
	 * configurations
	 */
	setup(): Promise<TestFsSet>;
}

class TestFsLocked extends Error {}

function normalize(child: Directory, parent = '.'): Directory {
	const grouped = Object.keys(child)
		// Get the top level files
		.map((location): [string, File | Directory] => {
			const contents = child[location];
			// Resolve the actual path starting from '/'
			// even if parent is different than `/`
			// e.g. ../somefile resolves to '/somefile'
			// ./some/../dir resolves to '/dir'
			const fromRoot = path.resolve('/', location);

			// The path resolves to `/`, which means the contents need
			// to be appended to the top level directory. If contents
			// is not a directory, then the specification is wrong
			if (fromRoot === '/' && !isDirectory(contents)) {
				throw new DirectoryIsInvalid(
					`Relative path '${[parent, location].join(
						path.sep,
					)}' resolves to '${parent}', but it's a regular file (expected a directory).'`,
				);
			}

			// Calculate the relative path from `/` to the directory
			// this is really removing the leading `/`
			const relPath = path.relative('/', fromRoot);

			// Return the normalize directories relative to /
			// along with the actual file
			return [relPath, contents];
		})
		// Group the directories by the first path element
		.reduce((normalized, [location, contents]) => {
			const [basedir, ...rest] = location.split(path.sep);

			// If the path resolution in the previous step returns ''
			// then contents need to be merged to the top level directory
			if (basedir === '') {
				// We validated this edge case in the previous step, so we
				// can assume contents is a directory
				return { ...normalized, ...(contents as Directory) };
			}

			// Get the existing directory contents
			const current = normalized[basedir];

			const file = path.join(...rest);

			if (isDirectory(current)) {
				if (rest.length === 0) {
					if (isDirectory(contents)) {
						// If there are no more path segments and both current and contents
						// are directories, merge them
						return {
							...normalized,
							[basedir]: { ...current, ...contents },
						};
					}

					// Otherwise use the latest instance
					return { ...normalized, [basedir]: contents };
				}

				// Add the file to the directory contents
				// any existing files with the same name will get replaced
				return {
					...normalized,
					[basedir]: {
						...current,
						[file]: contents,
					},
				};
			}

			// current is either a file, in which case it will get overwritten
			// or is undefined, in which case we can safely ignore it
			return {
				...normalized,
				[basedir]: rest.length > 0 ? { [file]: contents } : contents,
			};
		}, {} as Directory);

	// Recursively normalize the subdirectories
	return Object.keys(grouped).reduce((normalized, location) => {
		const contents = grouped[location];
		return {
			...normalized,
			[location]: isDirectory(contents)
				? // Normalize the directory recursively
				  normalize(contents, path.join(parent, location))
				: contents,
		};
	}, {} as Directory);
}

/**
 * Normalize a directory tree
 *
 * e.g.
 * ```
 * dir({
 *  '/etc/hosts': 'localhost',
 *  '/etc/service/a.conf': 'abc'
 *  '/etc': {
 *    '/etc/b.conf': 'def'
 *  }
 * })
 * ```
 * returns
 * ```
 * {
 *  '/etc': {
 *    'hosts': 'localhost'
 *    'service': {
 *      'a.conf': 'abc'
 *    }
 *    'etc': {
 *      'b.conf': 'def'
 *    }
 *  }
 * }
 * ```
 */
export function dir(root: Directory): Directory {
	return normalize(root);
}

/**
 * Get all directories at the top level of the given
 * directory spec
 */
function dirs(root: Directory): string[] {
	return Object.keys(root).filter((file) => isDirectory(root[file]));
}

/**
 * Get all files at the top level of the given
 * directory spec
 */
function files(root: Directory): string[] {
	return Object.keys(root).filter((file) => isFile(root[file]));
}

/**
 * Flatten a directory into a list of files
 */
function flatList(root: Directory, parent = '/'): Array<[string, File]> {
	return (
		files(root)
			// Add top level files to the list
			.map((file): [string, File] => [
				path.resolve(parent, file),
				root[file] as File,
			])
			.concat(
				dirs(root)
					// For each dir, calculate the list of files
					.map((dirname) =>
						flatList(root[dirname] as Directory, path.resolve(parent, dirname)),
					)
					// And flatten the array one level to end up with a list of pairs
					.flat(),
			)
			// Finally sort the list by filename, this is not really necessary but having the names
			// in order might come handy.
			.sort(([a], [b]) => a.localeCompare(b))
	);
}

/**
 * Flatten a nested directory definition into a single level spec.
 *
 * example:
 *
 * ```
 * flatten({
 *   '/etc': {
 *     'hosts': 'localhost'
 *     'service': {
 *       'a.conf': 'abc'
 *     }
 *     'etc': {
 *       'b.conf': 'def'
 *     }
 *   }
 * })
 * ```
 *
 * Returns
 * ```
 * {
 *   '/etc/hosts': 'localhost',
 *   '/etc/service/a.conf': 'abc',
 *   '/etc/etc/b.conf': 'def'
 * }
 * ```
 */
export function flatten(root: Directory): Directory {
	return flatList(normalize(root)).reduce(
		(res, [filename, contents]) => ({
			...res,
			[filename]: contents,
		}),
		{} as Directory,
	);
}

/**
 * Recursively write a directory spec to disk
 */
async function replace(spec: Directory, parent = '/') {
	// Create the parent if it doesn't exist
	if (parent !== '/') {
		await fs.mkdir(parent);
	}

	// Write all files first
	// TODO: this writes in parallel, if necessary we might want to write
	// in batches but maybe it won't be necessary given that this is for testing
	await Promise.all(
		files(spec).map((file) =>
			fs
				.open(path.join(parent, file), 'w')
				.then((fd) =>
					fd.writeFile(spec[file] as File).finally(() => fd.close()),
				),
		),
	);

	// Write child directories sequentially (depth-first)
	for (const dirPath of dirs(spec)) {
		await replace(spec[dirPath] as Directory, dirPath);
	}
}

function toChunks<T = any>(array: T[], chunkSize: number) {
	return Array.from(
		{ length: Math.ceil(array.length / chunkSize) },
		(_, index) => array.slice(index * chunkSize, (index + 1) * chunkSize),
	);
}

/**
 * Global tmpfs lock. Only one instance of tmpfs is allowed to be
 * in the setup state at the time. This global lock is taken by the setup() call
 * and the `acquire() call will fail the second time`
 */
const lock = (() => {
	let instance: TestFsSet | null = null;
	return {
		async acquire(tfs: TestFsSet) {
			if (instance != null) {
				// We need to restore the filesystem to prevent leaving it
				// in a bad state because of the thrown exception below
				await instance.restore();

				throw new TestFsLocked(
					'Only a single instance of TestFs can be set-up globally.',
				);
			}
			instance = tfs;
		},
		async release(force = false) {
			if (force && instance != null) {
				await instance.restore();
			}
			instance = null;
		},
	};
})();

/**
 * Global restore function. Should be used to cleanup any errors in case of failure
 */
async function restore() {
	await lock.release(true);
}

let defaults: TestFsConfig = {
	filesystem: {},
	keep: [],
	cleanup: [],
	rootdir: '/',
};

/**
 * Set global defaults for all test fs instances
 */
function config(conf: Partial<TestFsConfig>): void {
	defaults = { ...defaults, ...conf };
}

function build(
	spec: Directory = {},
	{
		rootdir = defaults.rootdir,
		keep = [],
		cleanup = [],
	}: Partial<TestFsOpts> = {},
): TestFsUnset {
	keep = [...defaults.keep, ...keep];
	cleanup = [...defaults.cleanup, ...cleanup];

	// Get the default directory spec
	const defaultSpec = flatten(defaults.filesystem);

	// Merge the given spec to the default spec.
	const toUpdate = flatten({ ...defaultSpec, ...spec });
	return {
		async setup() {
			const lookup = await Promise.all(
				Object.keys(toUpdate).map((filename) =>
					fs
						.access(path.resolve(rootdir, filename))
						.then(() => ({ filename, exists: true }))
						.catch(() => ({ filename, exists: false })),
				),
			);

			const keepGlobs = keep.concat(
				lookup.filter(({ exists }) => exists).map(({ filename }) => filename),
			);

			const cleanupGlobs = cleanup.concat(
				lookup.filter(({ exists }) => !exists).map(({ filename }) => filename),
			);

			const toKeep = await fg(keepGlobs, { cwd: rootdir });

			logger.debug('Backing up files', toKeep);
			const tarFile: string = await new Promise((resolve) => {
				const filename = path.join(os.tmpdir(), `mochapod-${nanoid()}.tar`);
				const stream = tar
					.pack(rootdir, {
						entries: toKeep.map((entry) => path.relative(rootdir, entry)),
					})
					.pipe(createWriteStream(filename));

				stream.on('finish', () => resolve(filename));
			});

			// Only allow a single restore
			let isRestored = false;

			// Return the restored
			const fsReady = {
				backup: tarFile,
				async restore() {
					if (isRestored) {
						return build(spec, { keep, cleanup });
					}

					// Cleanup the files form the cleanup glob
					const toCleanup = await fg(cleanupGlobs, { cwd: rootdir });
					for (const chunk of toChunks(toCleanup, 50)) {
						// Delete files in chunks of 50 ignoring failures
						await Promise.all(
							chunk.map((file) => fs.unlink(file).catch(() => void 0)),
						);
					}

					// Now restore the files from the backup
					logger.debug('Restoring files', toKeep);

					await new Promise((resolve) =>
						createReadStream(tarFile)
							.pipe(tar.extract(rootdir))
							.on('finish', resolve),
					);

					// Mark the system as restored to prevent this function from
					// doing any damage
					isRestored = true;

					// Remove the backup file
					await fs.unlink(tarFile).catch(() => void 0);

					// Restore the global lock
					await lock.release();

					// Return a new instance from the original option list
					return build(spec, { keep, cleanup });
				},
			};

			// Only now we take the lock before making changes to the original
			// filesystem. This is a little wasteful but it ensures that two
			// instances of testfs cannot be run in parallel (potentially damaging the system)
			// and that changes can be restored
			await lock.acquire(fsReady).catch((e) =>
				// If tmpfs is locked, delete the unused tar file
				// and throw the original exception
				fs
					.unlink(tarFile)
					.catch(() => void 0)
					.then(() => {
						throw e;
					}),
			);

			// Now that the files are backed up in memory we can replace
			// the originals with the replacements
			await replace(toUpdate).catch((e) =>
				// If an error occurs during replace, then try to restore
				// QUESTION: if replace failed, why would this succeed?
				fsReady.restore().then(() => {
					throw e;
				}),
			);

			return fsReady;
		},
	};
}

export interface TestFs {
	/**
	 * Create a testfs configuration from the given directory spec.
	 *
	 * On setup the method will prepare the filesystem for testing by performing the following
	 * operations.
	 *
	 * - Group the directory spec into existing/non-existing files. Existing files go into the keep list for backup and non-existing will go to the cleanup list.
	 * - Create a backup of all files matching the keep list
	 * - Replace all files from the directory spec into the filesystem.
	 *
	 * Note that attempts to call the setup function more than once will cause an exception.
	 *
	 * **IMPORTANT** don't use this module in a real (non-containerized) system, specially with admin permissions, you risk leaving the system
	 * in an inconsistent state if a crash happens before a `restore()` can be performed.
	 *
	 * @param spec          - Directory specification with files that need to be
	 *                        exist after set-up of the test fs. If the file exists previously
	 *                        in the given location it will be added to the `keep` list for restoring later.
	 *                        If it doesn't it will be added to the `cleanup` list to be removed during cleanup
	 * @param extra         - Additional options for the test fs
	 * @param extra.rootdir - Root directory for the directory spec. Defaults to '/'
	 * @param extra.keep    - List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
	 *                        identifying any files that should be backed up prior to setting up the
	 *                        filesystem. Any files that will be modified during the test should go here
	 * @param extra.cleanup - List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
	 *                        identifying  files that should be removed during the restore step.
	 *                        Add here any temporary files created during the test that should be cleaned up.
	 * @returns             - Unset TmpFs configuration
	 */
	(spec?: Directory, extra?: Partial<TestFsOpts>): TestFsUnset;

	/*
	 * Set global defaults for all test fs instances
	 *
	 * @param conf - additional configurations to use as defaults for all testfs instances
	 */
	config(conf: Partial<TestFsConfig>): void;

	/**
	 * Restore testsfs globally
	 */
	restore(): Promise<void>;
}

export const testfs: TestFs = Object.assign(build, { config, restore });
export default testfs;
