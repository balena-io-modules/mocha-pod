import { promises as fs } from 'fs';
import * as globby from 'globby';
import * as os from 'os';
import * as path from 'path';

import logger from '../logger';
import { MochaPodConfig } from '../config';
import testfs from '../testfs';

export class MochaPodError extends Error {}

export const mochaHooks = {
	async beforeAll() {
		// Confirm that we are running in a containerized environment
		await fs.access('/.dockerenv').catch(() => {
			throw new MochaPodError(
				'Not running in a containerized environment. Exiting to avoid damage.',
			);
		});

		const backups = await globby(path.join(os.tmpdir(), 'mochapod-*.tar'));
		if (backups.length > 0) {
			throw new MochaPodError(
				[
					`Found leftover backup file (${backups[0]}) from previous test run.`,
					'This probably means the test was interrupted before a call to',
					'the restore operation could be completed. The system needs to be brought back to',
					'its default state before running the test suite.',
				].join(' '),
			);
		}

		// Read config and set testfs default configuration
		const config = await MochaPodConfig();
		testfs.config(config.testfs);
		logger.debug('Using Config', JSON.stringify(config, null, 2));
	},

	async afterAll() {
		// Ensure the filesystem is restored in case the user forgot
		await testfs.restore();
	},
};
