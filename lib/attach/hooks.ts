import { promises as fs } from 'fs';
import * as fg from 'fast-glob';
import * as os from 'os';
import * as path from 'path';

import logger from '../logger';
import { MochaPodConfig } from '../config';
import testfs from '../testfs';

export class MochaPodError extends Error {}

export const mochaHooks = {
	async beforeAll() {
		// Confirm that we are running in a containerized environment
		await fs
			// This works in OS X at least
			.access('/.dockerenv')
			.catch(() =>
				// This should work most other places
				fs.readFile('/proc/self/cgroup', 'utf8').then((contents) => {
					const lines = contents.split(/\r?\n/);
					if (
						lines
							.map((l) => l.split(':'))
							.filter(([, , entry]) => entry && entry.startsWith('/docker'))
							.length === 0
					) {
						// Throw a place holder error
						throw new Error();
					}
				}),
			)
			// Catch any errors during the previous step. Do not run if there
			// are any doubts about this being a containerized enviroment
			.catch(() => {
				throw new MochaPodError(
					'It seems that you are in a containerized environment. Exiting to avoid damage.',
				);
			});

		const backups = await fg(path.join(os.tmpdir(), 'mochapod-*.tar'));
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
