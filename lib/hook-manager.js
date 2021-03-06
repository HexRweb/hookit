'use strict';

const Promise = require('bluebird');
const Hook = require('./hook');

function noHookError(hook) {
	const error = new Error(`Hook ${hook} doesn't exist`);
	error.code = 'ENOHOOK';
	return error;
}

const noop = output => output;

class HookManager {
	constructor() {
		this.hooks = {};
	}

	addHook(name, sync = false, resolver = false) {
		if (this.hooks[name]) {
			const error = new Error(`Hook ${name} is already registered`);
			error.code = 'EHOOKEXISTS';
			throw error;
		}

		if (!resolver) {
			resolver = noop;
		}

		this.hooks[name] = {
			hooks: [],
			resolver,
			sync
		};

		return true;
	}

	generateHookRegisterer(caller = 'default') {
		return (action, fn) => {
			if (!this.hooks[action]) {
				throw noHookError(action);
			}

			this.hooks[action].hooks.push(new Hook(fn, caller));
		};
	}

	executeHook(hook, resolverArgs, ...hookArgs) {
		if (!this.hooks[hook]) {
			return Promise.reject(noHookError(hook));
		}

		let promise;
		const errors = [];

		/*
		** There are 2 types of hooks - hooks which don't modify the input, and hooks that do. We
		** could add diffing logic to hooks that modify the input, but that's a lot of unnecessary
		** work (both for developers and performance). Instead, for sync hooks we reduce the second
		** argument, using the hooks execution as the reduction function. What this means is when
		** a sync hook is being executed, it can either be getting data fresh from the caller, or it
		** can be getting mutated data from a different hook. In the end, it doesn't matter because
		** there's an expectation that the hook function returns a result similar to the input
		*/
		if (this.hooks[hook].sync) {
			promise = Promise.reduce(
				this.hooks[hook].hooks,
				(resolver, singleHook) => singleHook.executeSync(resolver, ...hookArgs).catch(error => {
					errors.push(error);
					return resolver;
				}),
				hookArgs.shift()
			);
		} else {
			// For hooks which are just providing data, the hook resolver will handle reducing the hook
			// results. We're just mapping the hooks to the hook results
			promise = Promise.mapSeries(this.hooks[hook].hooks, singleHook =>
				// @todo: determine a bettor method of warning of a failed hook than just silently failing
				// Maybe emit an event?
				singleHook.execute(...hookArgs).catch(error => {
					errors.push(error);
					return false;
				})
			).filter(Boolean);
		}

		return promise.then(results => {
			// Don't use default params because `false` can be passed
			resolverArgs = resolverArgs || [];
			results = {
				results,
				errors
			};

			return this.hooks[hook].resolver(results, ...resolverArgs);
		});
	}
}

module.exports = HookManager;
