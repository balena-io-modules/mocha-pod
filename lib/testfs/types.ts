/**
 * Describe a file contents and configuration
 * options.
 */
export type File = string | Buffer;

/**
 * A directory is a recursive data structure of
 * named files and directories
 */
export interface Directory {
	[key: string]: File | Directory;
}

export interface Opts {
	/**
	 * Directory to use as base for the directory specification and glob search.
	 *
	 * @defaultValue `/`
	 */
	readonly rootdir: string;
	/**
	 * List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
	 * identifying any files that should be backed up prior to setting up the
	 * filesystem. Any files that will be modified during the test should go here
	 *
	 * @defaultValue `[]`
	 */
	readonly keep: string[];

	/**
	 * List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
	 * identifying  files that should be removed during the restore step.
	 * Add here any temporary files created during the test that should be cleaned up.
	 *
	 * @defaultValue `[]`
	 */
	readonly cleanup: string[];
}

/**
 * Describe a test filesystem that is in the enabled state.
 *
 * When in this state, the only possible action is to
 */
export interface Enabled {
	/**
	 * Location of the backup file
	 */
	readonly backup: string;

	/**
	 * Restore the environment to the state before the filesystem was setup
	 *
	 * The following operations are performed during restore
	 * - delete any files in the `cleanup` list
	 * - restore the original filesystem files from the backup
	 */
	restore(): Promise<Disabled>;
}

export interface Config extends Opts {
	/**
	 * Additional directory specification to be passed to `testfs()`
	 *
	 * @defaultValue `{}`
	 */
	readonly filesystem: Directory;
}

export interface Disabled {
	/**
	 * Setup the test environment with the provided test configurations
	 *
	 * The following operations are performed during this step.
	 *
	 * - Group the directory spec into existing/non-existing files. Existing files go into the keep list for backup and non-existing will go to the cleanup list.
	 * - Create a backup of all files matching the keep list
	 * - Replace all files from the directory spec into the filesystem.
	 *
	 * Note that attempts to call the setup function more than once will cause an exception.
	 */
	enable(): Promise<Enabled>;
}

export interface TestFs {
	/**
	 * Create a disabled testfs configuration from the given directory spec.
	 *
	 * Calling the {@link TestFs.Disabled.enable} method will prepare the filesystem for testing
	 * operations.
	 *
	 * **IMPORTANT** don't use this module in a real (non-containerized) system, specially with admin permissions, you risk leaving the system
	 * in an inconsistent state if a crash happens before a `restore()` can be performed.
	 *
	 * @param spec - Directory specification with files that need to be
	 *               exist after set-up of the test fs. If the file exists previously
	 *               in the given location it will be added to the `keep` list for restoring later.
	 *               If it doesn't it will be added to the `cleanup` list to be removed during cleanup
	 *               @defaultValue `{}`
	 * @param opts - Additional options for the test fs. @defaultValue `{}`
	 * @returns    - Disabled test fs configuration
	 */
	(spec?: Directory, opts?: Partial<Opts>): Disabled;

	/*
	 * Set global defaults for all test fs instances
	 *
	 * @param conf - additional configurations to use as defaults for all testfs instances
	 */
	config(conf: Partial<Config>): void;

	/**
	 * Restore testsfs globally.
	 *
	 * This function looks for a currently enabled instance of a test filesystem and calls
	 * {@link TestFs.Enabled.restore} on that instance.
	 */
	restore(): Promise<void>;

	/**
	 * Return any leftover backup files from previous invocations.
	 *
	 * If any leftovers exist prior to running {@link TestFs.Disabled.enable()}
	 * it means that a previous invocation did not terminate succesfully and is not
	 * safe to run the setup.
	 */
	leftovers(): Promise<string[]>;
}
