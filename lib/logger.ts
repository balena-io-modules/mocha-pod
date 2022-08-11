import debug from 'debug';

// Send logger.info() and logger.debug() output to stdout
const info = debug('mocha-pod');
info.log = console.info.bind(console);

const logger = {
	enable: debug.enable,
	info,
	error: debug('mocha-pod:error'),
	debug: info.extend('debug'),
};

export default logger;
