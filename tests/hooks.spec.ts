import { testfs, MochaPodConfig } from '~/mocha-pod';
import { promises as fs } from 'fs';

import { expect } from './chai';
import { exec as execSync } from 'child_process';
import { promisify } from 'util';

export const exec = promisify(execSync);

describe('hooks: integration tests', function () {
	it('global testfs configuration should be used', async () => {
		// Here we just check that the filesystem entry was set. Hooks
		// have already ran so we cannot modify config at this stage
		const conf = await MochaPodConfig();
		expect(conf.testfs.filesystem).to.not.be.undefined;

		await expect(
			fs.access('/etc/unused.conf'),
			'global testfs files should not exist before testfs.setup()',
		).to.be.rejected;

		const tmp = await testfs().setup();

		// The file contents should match whatever is in config
		expect(await fs.readFile('/etc/unused.conf', 'utf-8')).to.equal(
			'just for testing',
		);

		await tmp.restore();

		await expect(
			fs.access('/etc/unused.conf'),
			'global testfs files should not exist after testfs.restore()',
		).to.be.rejected;
	});
});
