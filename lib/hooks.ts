export const mochaHooks = {
	async beforeEach() {
		// TODO: prepare any volatile dependencies, i.e. dependencies that need
		// to be there for each test
		console.log('BEFORE HOOK');
	},
	async afterEach() {
		// reset the filesystem to the state that it was before
		// the test
		console.log('AFTER HOOK');
	},
};
