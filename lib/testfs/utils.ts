import { promises as fs } from 'fs';
import * as path from 'path';

import type {
	Directory,
	File,
	FileRef,
	FileContents,
	FileSpec,
	FileOpts,
	WithOptional,
} from './types';

const isString = (x: unknown): x is string =>
	x != null && (typeof x === 'string' || x instanceof String);

/**
 * Type guard to check if object is a file contents
 */
export const isFileContents = (x: unknown): x is FileContents =>
	x != null && (isString(x) || Buffer.isBuffer(x));

/**
 * Type guard to check if a object is a file reference
 */
export const isFileRef = (x: unknown): x is FileRef =>
	x != null && typeof x === 'object' && isString((x as { from: any }).from);

/**
 * Type guard to check if an object is a file specification
 */
export const isFileSpec = (x: unknown): x is FileSpec =>
	x != null &&
	typeof x === 'object' &&
	isFileContents((x as { contents: any }).contents);

/**
 * Type guard to idenfity an object as a file
 */
export const isFile = (x: unknown): x is File =>
	(x != null && isFileContents(x)) || isFileRef(x) || isFileSpec(x);

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
		.reduce<Directory>((normalized, [location, contents]) => {
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
		}, {});

	// Recursively normalize the subdirectories
	return Object.keys(grouped).reduce<Directory>((normalized, location) => {
		const contents = grouped[location];
		return {
			...normalized,
			[location]: isDirectory(contents)
				? // Normalize the directory recursively
					normalize(contents, path.join(parent, location))
				: contents,
		};
	}, {});
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
export function dirNames(root: Directory): string[] {
	return Object.keys(root).filter((file) => isDirectory(root[file]));
}

/**
 * Get all files at the top level of the given
 * directory spec
 */
export function fileNames(root: Directory): string[] {
	return Object.keys(root).filter((file) => isFile(root[file]));
}

/**
 * Create a file specification from a partial spec
 */
export function fileSpec(f: string | Buffer | Partial<FileSpec>): FileSpec {
	const now = new Date();

	// getuid and getgid are not available on Windows, this
	// prevents the typescript compiler from complaining
	const uid = (process.getuid ?? (() => 0))();
	const gid = (process.getgid ?? (() => 0))();
	if (isFileContents(f)) {
		return { contents: f, atime: now, mtime: now, uid, gid };
	}

	return { contents: '', mtime: now, atime: now, uid, gid, ...f };
}

/**
 * Create a file specification from a partial ref
 */
export function fileRef(
	f: string | WithOptional<FileRef, keyof FileOpts>,
	basedir = process.cwd(),
): FileRef {
	const now = new Date();

	// getuid and getgid are not available on Windows, this
	// prevents the typescript compiler from complaining
	const uid = (process.getuid ?? (() => 0))();
	const gid = (process.getgid ?? (() => 0))();
	if (isString(f)) {
		if (!path.isAbsolute(f)) {
			f = path.resolve(basedir, f);
		}
		return { from: f, mtime: now, atime: now, uid, gid };
	}

	return { mtime: now, atime: now, uid, gid, ...f };
}

/**
 * Flatten a directory into a list of files
 */
function flatList(root: Directory, parent = '/'): Array<[string, File]> {
	return (
		fileNames(root)
			// Add top level files to the list
			.map((file): [string, File] => [
				path.resolve(parent, file),
				root[file] as File,
			])
			.concat(
				dirNames(root)
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
	return flatList(normalize(root)).reduce<Directory>(
		(res, [filename, contents]) => ({
			...res,
			[filename]: contents,
		}),
		{},
	);
}

/**
 * Recursively write a directory spec to disk
 */
export async function replace(
	spec: Directory,
	parent = '/',
): Promise<string[]> {
	// Create the parent if it doesn't exist
	if (parent !== '/') {
		await fs.mkdir(parent).catch(() => {
			/** ignore */
		});
	}

	// Get the list of unique base directories for the given files
	const uniqueDirs = [
		...new Set(
			fileNames(spec)
				.map((filename) => path.dirname(filename))
				.filter((dirname) => dirname !== '.' && dirname !== '/')
				.map((dirname) => dirname),
		),
	];

	// Create all parent directories
	await Promise.all(
		uniqueDirs.map((dirname) =>
			fs.mkdir(path.join(parent, dirname), { recursive: true }).catch(() => {
				/** ignore */
			}),
		),
	);

	// Get file contents from references if any
	const filesWithSpec: Array<[string, FileSpec]> = await Promise.all(
		fileNames(spec).map(async (filename) => {
			const file = spec[filename];
			if (isFileContents(file) || isFileSpec(file)) {
				return [filename, fileSpec(file)];
			}

			const { from, ...opts } = fileRef(file as FileRef);
			return fs
				.readFile(from)
				.then((contents) => [filename, { contents, ...opts }]);
		}),
	);

	// Write all files first
	// TODO: this writes in parallel, if necessary we might want to write
	// in batches but maybe it won't be necessary given that this is for testing
	const modified = await Promise.all(
		filesWithSpec
			.map(
				([filename, filespec]) =>
					[path.join(parent, filename), filespec] as [string, FileSpec],
			)
			.map(([filepath, filespec]) =>
				fs
					.open(filepath, 'w')
					.then((fd) =>
						fd.writeFile(filespec.contents).finally(() => fd.close()),
					)
					.then(() => fs.chown(filepath, filespec.uid, filespec.gid))
					.then(() => fs.utimes(filepath, filespec.atime, filespec.mtime))
					.then(() => filepath),
			),
	);

	// Write child directories sequentially (depth-first)
	return dirNames(spec).reduce(
		(promise, dirPath) =>
			promise.then((accum) =>
				replace(spec[dirPath] as Directory, path.join(parent, dirPath)).then(
					(list) => accum.concat(list),
				),
			),
		Promise.resolve(modified),
	);
}
