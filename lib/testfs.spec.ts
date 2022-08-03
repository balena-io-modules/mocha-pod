import { expect } from '~/testing';

import { dir, flatten } from './testfs';

describe('testfs: unit tests', function () {
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
});
