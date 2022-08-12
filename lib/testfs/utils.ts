import { promises as fs } from 'fs';
import * as path from 'path';

import { Directory, File } from './types';

/**
 * Type guard to idenfity an object as a file
 */
export const isFile = (x: unknown): x is File =>
	x != null &&
	(typeof x === 'string' || x instanceof String || Buffer.isBuffer(x));

/**
 * Type guard to identify an object as a directory
 */
export const isDirectory = (x: File | Directory): x is Directory =>
	x != null && !isFile(x);

class DirectoryIsInvalid extends Error {}

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
export function dirs(root: Directory): string[] {
	return Object.keys(root).filter((file) => isDirectory(root[file]));
}

/**
 * Get all files at the top level of the given
 * directory spec
 */
export function files(root: Directory): string[] {
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
export async function replace(spec: Directory, parent = '/') {
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
