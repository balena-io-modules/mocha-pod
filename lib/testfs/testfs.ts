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
class TestFsAlreadyEnabled extends Error {}

function toChunks<T = any>(array: T[], chunkSize: number) {
	return Array.from(
		{ length: Math.ceil(array.length / chunkSize) },
		(_, index) => array.slice(index * chunkSize, (index + 1) * chunkSize),
	);
}

const debug = logger.info.extend('testfs');

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
		execution_timeout: 1000 * 60 * 5, // Time out after 5 minutes
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
		async acquire(enableFn: Disabled['enable']) {
			// Only allow one enable funciton to be ran at once
			const instance = await l.acquire(enableFn);

			// Add the instance to the stack. Instances can
			// only be restored in the order that they were taken
			// to prevent leaving the filesystem in a weird state
			stack.push(instance);

			return instance;
		},
		async release(id: Enabled['id'], restoreFn: Enabled['restore']) {
			assert(stack.length > 0); // this should never happen

			// Peek the top of the stack
			const last = stack[stack.length - 1];
			if (last.id !== id) {
				// Restore the filesystem before throwiing
				await releaseAll();

				throw new TestFsLockError(
					`Tried to restore testfs instance with '${id}', but last enabled instance was '${last.id}'. Restoring files in the wrong order may leave the system in an inconsistent state.`,
				);
			}

			// Only once restore call can be running at the same time
			const res = await l.acquire(restoreFn);

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

	// Record the instance state
	let isDisabled = true;
	let enabled: Enabled = {
		id: '0',
		restore: () => Promise.resolve(disabled),
		cleanup: () => Promise.resolve(enabled),
	};
	const disabled: Disabled = {
		async enable() {
			if (!isDisabled) {
				await enabled.restore();
				throw new TestFsAlreadyEnabled(`TestFs instance already enabled`);
			}

			return lock.acquire(async () => {
				const lookup = (
					await Promise.all(
						Object.keys(toUpdate).map((filename) =>
							fs
								.access(path.resolve(rootdir, filename))
								.then(() => ({ filename, exists: true }))
								.catch(() => ({ filename, exists: false })),
						),
					)
				).concat(
					// If any files in the cleanup list exist before the test, we need to
					// add them to the backup
					await fg(cleanup, { cwd: rootdir }).then((files) =>
						files.map((filename) => ({ filename, exists: true })),
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

				debug('enable: backing up files', toKeep);
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

				// Create the restore function to be used in case of any errors
				const doRestore = async () => {
					// Get the files using the cleanup glob
					const toCleanup = await fg(cleanupGlobs, { cwd: rootdir });
					for (const chunk of toChunks(toCleanup, 50)) {
						// Delete files in chunks of 50 ignoring failures
						await Promise.all(
							chunk.map((file) => fs.unlink(file).catch(() => void 0)),
						);
					}
					debug('restore: deleted', toCleanup);

					// Now restore the files from the backup
					await new Promise((resolve) =>
						createReadStream(tarFile)
							.pipe(tar.extract(rootdir))
							.on('finish', resolve),
					);
					debug('restore: recovered', toKeep);

					// Remove the backup file
					await fs.unlink(tarFile).catch(() => void 0);

					// Mark the system as disabled to prevent this function from
					// doing any damage
					isDisabled = true;

					// Return the original instance from the original option list
					return disabled;
				};

				// Now that the files are backed up in memory we can replace
				// the originals
				const modified = await replace(toUpdate).catch((e) =>
					// If replace fails, we try to restore immediately, although
					// it is unlikely to succeed, then throw the original exception
					doRestore().then(() => {
						throw e;
					}),
				);
				debug('enable: test filesystem ready! Wrote', modified);

				const doCleanup = async () => {
					// Cleanup any files in the cleanup list first
					const toCleanup = await fg(cleanup, { cwd: rootdir });
					for (const chunk of toChunks(toCleanup, 50)) {
						// Delete files in chunks of 50 ignoring failures
						await Promise.all(
							chunk.map((file) => fs.unlink(file).catch(() => void 0)),
						);
					}

					return toCleanup;
				};

				// Return the enable object
				enabled = {
					id,
					async cleanup() {
						const deleted = await doCleanup();
						debug('cleanup: deleted', deleted);
						return enabled;
					},
					async restore() {
						if (isDisabled) {
							return disabled;
						}

						return lock.release(id, doRestore);
					},
				};

				// Mark the instance as enabled
				isDisabled = false;

				return enabled;
			});
		},
		async restore() {
			return enabled.restore();
		},
	};
	return disabled;
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
