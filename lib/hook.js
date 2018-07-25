'use strict';

const Promise = require('bluebird');

class Hook {
	constructor(fn, caller = 'default') {
		this.fn = fn;
		this.caller = caller;
	}

	/*
	** Async hooks resolve an array which needs to be processed by a resolver. We return an object
	** with the context (`from`), and the return value (`result`) which can be helpful for debugging
	** or namespace collision prevention (i.e. if you create a hook which adds methods to an
	** object, and 2 hooks want to add `method`, the second hook would override the first hook,
	** so you could instead do `${from}-method` after running collision detection)
	*/

	execute(...args) {
		return this.executeSync(...args).then(result => ({
			from: this.caller,
			result
		}));
	}

	executeSync(...args) {
		try {
			return Promise.resolve(this.fn(...args));
		} catch (error) {
			return Promise.reject(error);
		}
	}
}

module.exports = Hook;
