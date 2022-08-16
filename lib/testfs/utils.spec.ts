import { expect } from '~/testing';

import { promises as fs } from 'fs';
import * as mock from 'mock-fs';
import { dir, flatten, replace } from './utils';

describe('testfs/utils: unit tests', function () {
	describe('dir', () => {
		it('normalizes an empty directory', () => {
			expect(dir({})).to.deep.equal({});
		});

		it('normalizes an empty directory with relative paths', () => {
			expect(dir({ '.': {} })).to.deep.equal({});
		});

		it('normalizes a directory with relative paths', () => {
			expect(dir({ './../.': { somefile: 'content' } })).to.deep.equal({
				somefile: 'content',
			});
		});

		it('fails if the relative path is not a directory', () => {
			expect(() => dir({ '.': 'contents' })).to.throw();
			expect(() => dir({ './../..': 'contents' })).to.throw();
		});

		it('groups by the parent directory', () => {
			expect(
				dir({
					'/etc': { somefile: 'some' },
					'/etc/otherfile': 'other',
					'/etc/dir': { third: 'last' },
				}),
			).to.deep.equal({
				etc: {
					somefile: 'some',
					otherfile: 'other',
					dir: { third: 'last' },
				},
			});
		});

		it('uses the latest value of the file in case of duplicates', () => {
			expect(
				dir({
					'/someFile': 'first',
					'./someFile': 'second',
				}),
			).to.deep.equal({
				someFile: 'second',
			});

			expect(
				dir({
					'/etc': { somefile: 'some' },
					'/etc/somefile': 'other',
					'/etc/dir': { third: 'last' },
				}),
			).to.deep.equal({
				etc: {
					somefile: 'other',
					dir: { third: 'last' },
				},
			});
		});

		it('uses the latest value of the location definition in case of duplicates', () => {
			expect(
				dir({
					'/etc': { somefile: 'some' },
					'/etc/somefile': { reallyadir: 'this will be used' },
					'/etc/dir': { third: 'last' },
				}),
			).to.deep.equal({
				etc: {
					somefile: { reallyadir: 'this will be used' },
					dir: { third: 'last' },
				},
			});
			expect(
				dir({
					'/dirOrFile/': { hasfile: 'value' },
					'/dirOrFile': 'now is a file',
				}),
			).to.deep.equal({ dirOrFile: 'now is a file' });
			expect(
				dir({
					'/dirOrFile': 'a file',
					'/dirOrFile/': { hasfile: 'value' },
				}),
			).to.deep.equal({ dirOrFile: { hasfile: 'value' } });
		});

		it('merges duplicate directories on the same level', () => {
			expect(
				dir({
					'/dir/': { hasfile: 'value' },
					'/dir': { otherfile: 'value' },
				}),
			).to.deep.equal({ dir: { hasfile: 'value', otherfile: 'value' } });
		});
	});

	describe('flatten', function () {
		it('flattens an empty directory', () => {
			expect(flatten({})).to.deep.equal({});
		});

		it('flattens an empty directory with relative paths', () => {
			expect(flatten({ '.': {} })).to.deep.equal({});
		});

		it('flattens a directory with relative paths', () => {
			expect(flatten({ './../.': { somefile: 'content' } })).to.deep.equal({
				'/somefile': 'content',
			});
		});

		it('normalizes the directory before flattening', () => {
			expect(() => flatten({ '.': 'contents' })).to.throw();
			expect(() => flatten({ './../..': 'contents' })).to.throw();
		});

		it('uses the latest value of the file in case of duplicates', () => {
			expect(
				flatten({
					'/someFile': 'first',
					'./someFile': 'second',
				}),
			).to.deep.equal({
				'/someFile': 'second',
			});

			expect(
				flatten({
					'/etc': { somefile: 'some' },
					'/etc/somefile': 'other',
					'/etc/dir': { third: 'last' },
					'/etc/otherdir': {},
				}),
			).to.deep.equal({
				'/etc/somefile': 'other',
				'/etc/dir/third': 'last',
			});
		});

		it('uses the latest value of the location definition in case of duplicates', () => {
			expect(
				flatten({
					'/etc': { somefile: 'some' },
					'/etc/somefile': { reallyadir: 'this will be used' },
					'/etc/dir': { third: 'last' },
				}),
			).to.deep.equal({
				'/etc/somefile/reallyadir': 'this will be used',
				'/etc/dir/third': 'last',
			});
			expect(
				flatten({
					'/dirOrFile/': { hasfile: 'value' },
					'/dirOrFile': 'now is a file',
				}),
			).to.deep.equal({ '/dirOrFile': 'now is a file' });
			expect(
				flatten({
					'/dirOrFile': 'a file',
					'/dirOrFile/': { hasfile: 'value' },
				}),
			).to.deep.equal({ '/dirOrFile/hasfile': 'value' });
		});

		it('merges duplicate directories on the same level', () => {
			expect(
				flatten({
					'/dir/': { hasfile: 'value' },
					'/dir': { otherfile: 'value' },
				}),
			).to.deep.equal({ '/dir/hasfile': 'value', '/dir/otherfile': 'value' });
		});
	});

	describe('replace', () => {
		it('writes files at the top level directory', async () => {
			mock({ '/etc': {} });

			await replace(
				{ 'a.conf': 'FIRST FILE', 'b.conf': 'SECOND FILE' },
				'/etc',
			);

			expect(await fs.readFile('/etc/a.conf', 'utf8')).to.equal('FIRST FILE');
			expect(await fs.readFile('/etc/b.conf', 'utf8')).to.equal('SECOND FILE');

			mock.restore();
		});

		it('creates parent directory if it does not exist', async () => {
			mock({ '/etc': {} });

			await replace(
				{
					'/service-a/a.conf': 'FIRST FILE',
					'/service-b/b.conf': 'SECOND FILE',
				},
				'/etc',
			);

			expect(await fs.readFile('/etc/service-a/a.conf', 'utf8')).to.equal(
				'FIRST FILE',
			);
			expect(await fs.readFile('/etc/service-b/b.conf', 'utf8')).to.equal(
				'SECOND FILE',
			);

			mock.restore();
		});

		it('creates directories recursively as necessary', async () => {
			mock({ '/etc': {} });

			await replace(
				{
					'/service-a': { 'a.conf': 'FIRST FILE' },
					'/service-b': { 'subdir/b.conf': 'SECOND FILE' },
				},
				'/etc',
			);

			expect(await fs.readFile('/etc/service-a/a.conf', 'utf8')).to.equal(
				'FIRST FILE',
			);
			expect(
				await fs.readFile('/etc/service-b/subdir/b.conf', 'utf8'),
			).to.equal('SECOND FILE');

			mock.restore();
		});

		it('replaces file if it already exists', async () => {
			mock({
				'/etc': {
					'service-a': { 'a.conf': 'FIRST FILE OLD' },
					'service-b': { 'subdir/b.conf': 'SECOND FILE OLD' },
				},
			});

			await replace(
				{
					'/service-a': { 'a.conf': 'FIRST FILE' },
					'/service-b': { 'subdir/b.conf': 'SECOND FILE' },
				},
				'/etc',
			);

			expect(await fs.readFile('/etc/service-a/a.conf', 'utf8')).to.equal(
				'FIRST FILE',
			);
			expect(
				await fs.readFile('/etc/service-b/subdir/b.conf', 'utf8'),
			).to.equal('SECOND FILE');

			mock.restore();
		});
	});
});
