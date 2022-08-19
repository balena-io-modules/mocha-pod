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
		const tmp = await testfs({
			// This file doesn't exist before the test
			'/etc/other.conf': 'debug=1',
		}).enable();

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

	it('only one tmpfs instance can be running globally', async () => {
		// The file should not exist before the test
		await expect(
			fs.access('/etc/other.conf'),
			'file should not exist before the test',
		).to.be.rejected;

		// Prepare a new test fs
		await testfs({
			// This file doesn't exist before the test
			'/etc/other.conf': 'debug=1',
		}).enable();

		// The file should be available after setup
		expect(await fs.readFile('/etc/other.conf', 'utf-8')).to.equal('debug=1');

		await expect(
			testfs({ '/usr/etc/other.conf': 'debug=1' }).enable(),
			'second call to setup() should fail',
		).to.be.rejected;

		await expect(
			fs.access('/usr/etc/other.conf'),
			'file should not be created if setup fails',
		).to.be.rejected;

		// The file system should be restored to the original state by the exception
		await expect(
			fs.access('/etc/other.conf'),
			'system should be restored by a setup failure',
		).to.be.rejected;
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
