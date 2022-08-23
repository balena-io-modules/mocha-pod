import { promises as fs } from 'fs';

import logger from '../logger';
import { Config } from '../config';
import { testfs } from '../testfs';

class HooksFailure extends Error {}

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
				throw new HooksFailure(
					'It seems that integration tests are not being run in a containerized environment. Exiting to avoid damage.',
				);
			});

		const crumbs = await testfs.leftovers();
		if (crumbs.length > 0) {
			throw new HooksFailure(
				[
					`Found leftover testfs backup file(s): ${JSON.stringify(crumbs)})`,
					'This probably means the test was interrupted before a call to',
					'the restore operation could be completed. The system needs to be brought back to',
					'its default state before running the test suite.',
				].join(' '),
			);
		}

		// Read config and set testfs default configuration
		const config = await Config();
		testfs.config({ basedir: config.basedir, ...config.testfs });
		logger.debug('Using Config', JSON.stringify(config, null, 2));
	},

	async afterAll() {
		// Ensure the filesystem is restored in case the user forgot
		await testfs.restore();
	},
};
