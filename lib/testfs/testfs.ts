import * as fg from 'fast-glob';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar-fs';
import logger from '../logger';

import { nanoid } from 'nanoid';

import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { flatten, replace } from './utils';

import { Config, Directory, Disabled, Enabled, Opts, TestFs } from './types';

class TestFsLocked extends Error {}

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
	let instance: Enabled | null = null;
	return {
		async acquire(tfs: Enabled) {
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

let defaults: Config = {
	filesystem: {},
	keep: [],
	cleanup: [],
	rootdir: '/',
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
				const filename = path.join(os.tmpdir(), `testfs-${nanoid()}.tar`);
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

async function leftovers(): Promise<string[]> {
	return await fg(path.join(os.tmpdir(), 'testfs-*.tar'));
}

export const testfs: TestFs = Object.assign(build, {
	config,
	restore,
	leftovers,
});
export default testfs;
