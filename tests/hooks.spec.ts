import { testfs, MochaPod } from '~/mocha-pod';
import { promises as fs } from 'fs';

import { expect } from './chai';

describe('hooks: integration tests', function () {
	it('global testfs configuration should be used', async () => {
		// Here we just check that the filesystem entry was set. Hooks
		// have already ran so we cannot modify config at this stage
		const conf = await MochaPod.Config();
		expect(conf.testfs.filesystem).to.not.be.undefined;

		await expect(
			fs.access('/etc/unused.conf'),
			'global testfs files should be set by the beforeAll hook',
		).to.not.be.rejected;
		await expect(
			fs.access('/etc/extra.conf'),
			'global testfs files should be set by the beforeAll hook',
		).to.not.be.rejected;

		// The file contents should match whatever is in config
		expect(await fs.readFile('/etc/unused.conf', 'utf-8')).to.equal(
			'just for testing',
		);

		await expect(
			fs.access('/etc/other.conf'),
			'local test files should not exist before `enable`',
		).to.be.rejected;

		const tmp = await testfs({
			'/etc/other.conf': 'debug=1',
			'/etc/unused.conf': 'something else',
		}).enable();

		// The new value needs to be set
		expect(await fs.readFile('/etc/unused.conf', 'utf-8')).to.equal(
			'something else',
		);

		// Additional files configured need to be given the new value
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		// Files defined in config with `from` need to be loaded by the global hook
		expect(await fs.readFile('/etc/extra.conf', 'utf-8')).to.equal(
			await fs.readFile('tests/data/extra.conf', 'utf-8'),
		);

		await tmp.restore();

		await expect(
			fs.access('/etc/other.conf'),
			'local test files should not exist after `restore`',
		).to.be.rejected;

		expect(await fs.readFile('/etc/unused.conf', 'utf-8')).to.equal(
			'just for testing',
		);
		await expect(
			fs.access('/etc/extra.conf'),
			'global testfs files are restored be set by global afterAll hook',
		).to.not.be.rejected;
	});
});
