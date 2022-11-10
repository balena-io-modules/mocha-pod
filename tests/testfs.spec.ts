import * as path from 'path';
import { testfs } from '~/mocha-pod';
import { promises as fs } from 'fs';

import { expect } from './chai';
import { exec as execSync } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execSync);

describe('testfs: integration tests', function () {
	it('setup should backup any files modified by the given directory spec', async () => {
		// Create a dummy test file.
		await fs
			.open('/etc/test.conf', 'w')
			.then((handle) =>
				handle.writeFile('logging=false').finally(() => handle.close()),
			);

		// Prepare a new test fs
		const tmp = await testfs({
			// This file exists before
			'/etc/test.conf': 'logging=true',
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/test.conf', 'utf-8')).to.equal(
			'logging=true',
		);

		// Restore the filesystem
		await tmp.restore();

		// The original test.conf should be available
		expect(await fs.readFile('/etc/test.conf', 'utf-8')).to.equal(
			'logging=false',
		);

		// clean up the test file
		await fs.unlink('/etc/test.conf').catch();
	});

	it('setup should delete any files created by the given directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const tmp = testfs({
			// This file doesn't exist before the test
			'/etc/other.conf': 'debug=1',
		});

		// Enable the instance
		await tmp.enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		// Restore the filesystem
		await tmp.restore();

		// The file should not be available after restoration
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;

		// Enable the instance again
		await tmp.enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		// Restore the filesystem
		await tmp.restore();

		// The file should not be available after restoration
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should backup any files identified in the `keep` list', async () => {
		const origHostname = await fs.readFile('/etc/hostname', 'utf-8');
		const tmp = await testfs({}, { keep: ['/etc/hostname'] }).enable();

		// Call a system program that modifies the file
		await exec('echo -n "myhostname" > /etc/hostname');

		expect(await fs.readFile('/etc/hostname', 'utf-8')).to.equal('myhostname');

		// Restore the filesystem
		await tmp.restore();

		expect(await fs.readFile('/etc/hostname', 'utf-8')).to.equal(origHostname);
	});

	it('setup should delete any files identified in the `cleanup` list', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		const tmp = await testfs({}, { cleanup: ['/etc/other.conf'] }).enable();

		// Create a file to a separate system program
		await exec('echo -n "debug=1" > /etc/other.conf');

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('allows multiple instances to be set', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const first = await testfs({
			// This file doesn't exist before the test
			'/etc/other.conf': 'debug=1',
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');
		await expect(fs.access('/usr/etc/other.conf')).to.be.rejected;

		// Setting up a new testfs instance is allowed
		const second = await testfs({
			'/etc/other.conf': 'debug=0',
			'/usr/etc/other.conf': 'logging=true',
		}).enable();

		// The file now has the new value
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=0');

		// And also the new file
		expect(await fs.readFile('/usr/etc/other.conf', 'utf-8')).to.equal(
			'logging=true',
		);

		// Instances can be restored in the reverse order
		await expect(second.restore()).to.not.be.rejected;

		// The file should have the same value as before the second instance was set
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		// Restore the first instance
		await expect(first.restore()).to.not.be.rejected;

		// The system now has the same state as before the test
		await expect(fs.access('/etc/other.conf')).to.be.rejected;
		await expect(fs.access('/usr/etc/other.conf')).to.be.rejected;
	});

	it('rejects instances being restored in the wrong order', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const tmp = await testfs({
			// This file doesn't exist before the test
			'/etc/other.conf': 'debug=1',
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		// Setting up a new testfs instance is allowed
		await testfs({
			'/etc/other.conf': 'debug=0',
			'/usr/etc/other.conf': 'logging=true',
		}).enable();

		// The file now has the new value
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=0');

		// And also the new file
		expect(await fs.readFile('/usr/etc/other.conf', 'utf-8')).to.equal(
			'logging=true',
		);

		// Restoring the first testfs instance should fail
		await expect(tmp.restore()).to.be.rejected;

		// The file system should be restored to the original state by the exception
		await expect(fs.access('/etc/other.conf')).to.be.rejected;
		await expect(fs.access('/usr/etc/other.conf')).to.be.rejected;
	});

	it('rejects enabling an instance more than once', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const tmp = testfs({
			// This file doesn't exist before the test
			'/etc/other.conf': 'debug=1',
		});

		// Enable the instance
		await tmp.enable();

		// The file has been created
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		// Try to enable the instance again
		await expect(tmp.enable()).to.be.rejected;

		// The file system should be restored to the original state by the exception
		await expect(
			fs.access('/etc/other.conf'),
			'file was restored before the exception',
		).to.be.rejected;
	});

	it('restoring an instance before it is enabled should not have any side effects', async () => {
		// Create a dummy test file.
		await fs.writeFile('/etc/other.conf', 'debug=0');

		// Prepare a new test fs
		const tmp = testfs({}, { cleanup: ['/etc/other.conf'] });

		// The file still exists because the instance has not been enabled
		await tmp.restore();
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=0');

		// Enable the instance
		await tmp.enable();

		// The file still has the same value
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=0');

		// Modify the file
		await fs.writeFile('/etc/other.conf', 'debug=1');

		// The file has been restored to the initial state
		await tmp.restore();
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=0');

		// Further restores have no effect
		await tmp.restore();
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=0');

		// Restore the filesystem
		await fs.unlink('/etc/other.conf');
	});

	it('setup should allow to reference files through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const tmp = await testfs({
			// Create a file reference
			'/etc/other.conf': testfs.from('tests/data/dummy.conf'),
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal(
			await fs.readFile(
				path.join(process.cwd(), 'tests/data/dummy.conf'),
				'utf8',
			),
		);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to reference files and set mtime through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const mtime = new Date('2022-08-16T17:00:00Z');
		const tmp = await testfs({
			// Create a file reference
			'/etc/other.conf': testfs.from({ from: 'tests/data/dummy.conf', mtime }),
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal(
			await fs.readFile(
				path.join(process.cwd(), 'tests/data/dummy.conf'),
				'utf8',
			),
		);
		// The file should be available after setup and have the proper time
		const fStat = await fs.stat('/etc/other.conf');
		expect(fStat.mtime).to.deep.equal(mtime);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to reference files and set atime through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const atime = new Date('2022-08-16T17:00:00Z');
		const tmp = await testfs({
			// Create a file reference
			'/etc/other.conf': testfs.from({ from: 'tests/data/dummy.conf', atime }),
		}).enable();

		// The file should be available after setup and have the proper time
		const fStat = await fs.stat('/etc/other.conf');
		expect(fStat.atime).to.deep.equal(atime);

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal(
			await fs.readFile(
				path.join(process.cwd(), 'tests/data/dummy.conf'),
				'utf8',
			),
		);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to reference files via absolute path through the directory spec', async () => {
		// Create a dummy test file.
		await fs
			.open('/tmp/dummy.conf', 'w')
			.then((handle) =>
				handle.writeFile('logging=false').finally(() => handle.close()),
			);

		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const tmp = await testfs({
			// Create a file reference
			'/etc/other.conf': testfs.from('/tmp/dummy.conf'),
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal(
			'logging=false',
		);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to configure file last access time through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const atime = new Date('2022-08-16T17:00:00Z');
		const tmp = await testfs({
			// Create a file with a set atime
			'/etc/other.conf': testfs.file({ contents: 'loglevel=debug', atime }),
		}).enable();

		// The file should be available after setup and have the proper time
		const fStat = await fs.stat('/etc/other.conf');
		expect(fStat.atime).to.deep.equal(atime);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to configure file last modification time through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const mtime = new Date('2022-08-16T17:00:00Z');
		const tmp = await testfs({
			// Create a file with a set atime
			'/etc/other.conf': testfs.file({ contents: 'loglevel=debug', mtime }),
		}).enable();

		// The file should be available after setup and have the proper time
		const fStat = await fs.stat('/etc/other.conf');
		expect(fStat.mtime).to.deep.equal(mtime);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to configure file uid through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const uid = 65534;
		const tmp = await testfs({
			// Create a file with a set atime
			'/etc/other.conf': testfs.file({ contents: 'loglevel=debug', uid }),
		}).enable();

		// The file should be available after setup and have the proper time
		const fStat = await fs.stat('/etc/other.conf');
		expect(fStat.uid).to.deep.equal(uid);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});

	it('setup should allow to configure file uid through the directory spec', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		const gid = 65534;
		const tmp = await testfs({
			// Create a file with a set atime
			'/etc/other.conf': testfs.file({ contents: 'loglevel=debug', gid }),
		}).enable();

		// The file should be available after setup and have the proper time
		const fStat = await fs.stat('/etc/other.conf');
		expect(fStat.gid).to.deep.equal(gid);

		// Restore the filesystem
		await tmp.restore();

		// The file should have been removed
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist after the test',
		).to.be.rejected;
	});
});
