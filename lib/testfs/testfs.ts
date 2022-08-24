import * as fg from 'fast-glob';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar-fs';
import logger from '../logger';
import { strict as assert } from 'assert';
import { BetterLock } from 'better-lock';
import { nanoid } from 'nanoid';

import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { flatten, replace, fileRef, fileSpec } from './utils';

import {
	Config,
	Directory,
	Disabled,
	Enabled,
	Opts,
	TestFs,
	WithOptional,
	FileRef,
	FileOpts,
} from './types';

class TestFsLockError extends Error {}

function toChunks<T = any>(array: T[], chunkSize: number) {
	return Array.from(
		{ length: Math.ceil(array.length / chunkSize) },
		(_, index) => array.slice(index * chunkSize, (index + 1) * chunkSize),
	);
}

/**
 * Global tmpfs locking behavior. Only one call to `enable` or `restore` can be ran
 * at once, to prevent the filesystem to be left in an inconsistent state.
 *
 * Calls to `restore` need to be executed in the reverse order that calls to `enable` were
 * performed.
 *
 * e.g.
 *
 * ```
 * const fsOne = await testfs({'/etc/hostname': 'one'}).enable();
 * // This second call is allowed
 * const fsTwo = await testfs({'/etc/hostname': 'two'}).enable();
 *
 * // Trying to restore in a different order will throw
 * await fsTwo.restore(); // this will throw!
 * ```
 *
 */
const lock = (() => {
	// use betterlock for synchronization
	const l = new BetterLock({
		name: 'testfs', // To be used in error reporting and logging
		log: logger.debug, // Give it your logger with appropeiate level
		wait_timeout: 1000 * 30, // Max 30 sec wait in queue
		execution_timeout: 1000 * 60 * 5, // Time out after 5 minutes
		queue_size: 1,
	});

	// Stack of currently locked instances.
	// only the top of the stack can be restored
	const stack = [] as Enabled[];

	const releaseAll = async () => {
		while (stack.length > 0) {
			// The call to restore pop the last element from
			// the stack
			await stack[stack.length - 1].restore();
		}
	};
	return {
		async acquire(tEnable: Disabled['enable']) {
			// Only allow one enable funciton to be ran at once
			const instance = await l.acquire(tEnable);

			// Add the instance to the queue. Instances can
			// only be restored in the order that they were taken
			// to prevent leaving the filesystem in a weird state
			stack.push(instance);

			return instance;
		},
		async release(id: string, tRestore: Enabled['restore']) {
			assert(stack.length > 0); // this should never happen

			// Peek the top of the stack
			const last = stack[stack.length - 1];
			if (last.id !== id) {
				// Restore the filesystem before throwiing
				await releaseAll();

				throw new TestFsLockError(
					`Tried to restore instance '${id}', while last locked instance was '${last.id}'. Trying to restore files in the wrong order might leave the system in an inconsistent state.`,
				);
			}

			// Only once restore call can be running at the same time
			const res = await l.acquire(tRestore);

			// Pop the top element from the stack
			stack.pop();

			return res;
		},
		releaseAll,
	};
})();

/**
 * Global restore function. Should be used to cleanup any errors in case of failure
 */
async function restore() {
	await lock.releaseAll();
}

let defaults: Config = {
	filesystem: {},
	keep: [],
	cleanup: [],
	rootdir: '/',
	basedir: process.cwd(),
};

/**
 * Set global defaults for all test fs instances
 */
function config(conf: Partial<Config>): void {
	defaults = { ...defaults, ...conf };
}

function build(
	spec: Directory = {},
	{ rootdir = defaults.rootdir, keep = [], cleanup = [] }: Partial<Opts> = {},
): Disabled {
	keep = [...defaults.keep, ...keep];
	cleanup = [...defaults.cleanup, ...cleanup];

	// Get the default directory spec
	const defaultSpec = flatten(defaults.filesystem);

	// Merge the given spec to the default spec.
	const toUpdate = flatten({ ...defaultSpec, ...spec });
	return {
		async enable() {
			return lock.acquire(async () => {
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
					lookup
						.filter(({ exists }) => !exists)
						.map(({ filename }) => filename),
				);

				const toKeep = await fg(keepGlobs, { cwd: rootdir });

				logger.debug('Backing up files', toKeep);
				const id = nanoid();
				const tarFile: string = await new Promise((resolve) => {
					const filename = path.join(os.tmpdir(), `testfs-${id}.tar`);
					const stream = tar
						.pack(rootdir, {
							entries: toKeep.map((entry) => path.relative(rootdir, entry)),
						})
						.pipe(createWriteStream(filename));

					stream.on('finish', () => resolve(filename));
				});

				// Only allow a single restore per instance
				let isRestored = false;

				// Return the restored
				const fsReady = {
					id,
					backup: tarFile,
					async restore() {
						if (isRestored) {
							return build(spec, { keep, cleanup });
						}

						return lock.release(id, async () => {
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

							// Return a new instance from the original option list
							return build(spec, { keep, cleanup });
						});
					},
				};

				// Now that the files are backed up in memory we can replace
				// the originals with the replacements
				await replace(toUpdate);

				return fsReady;
			});
		},
	};
}

async function leftovers(): Promise<string[]> {
	return await fg(path.join(os.tmpdir(), 'testfs-*.tar'));
}

export const testfs: TestFs = Object.assign(build, {
	config,
	restore,
	leftovers,
	file: fileSpec,
	from: (f: string | WithOptional<FileRef, keyof FileOpts>) =>
		fileRef(f, defaults.basedir),
});
export default testfs;
