const sinon = require('sinon');
const {expect} = require('chai');
const Hook = require('../../lib/hook');
const HookManager = require('../../lib/hook-manager');
const noop = require('../utils/noop');
const expectError = require('../utils/expect-error');

/* eslint-disable max-nested-callbacks */

describe('Unit > Hook Manager', function () {
	let hm;

	beforeEach(() => {
		hm = new HookManager();
	});

	it('constructs', function () {
		expect(hm.hooks).to.be.an('object');
	});

	describe('addHook', function () {
		it('general functionality', function () {
			const resolver = sinon.stub();
			return hm.addHook('testHook', resolver, true).then(() => {
				expect(hm.hooks.testHook).to.be.ok;
				expect(hm.hooks.testHook.sync).to.be.true;
				expect(hm.hooks.testHook.hooks).to.be.an('array').with.lengthOf(0);
				expect(hm.hooks.testHook.resolver).to.equal(resolver);
			});
		});

		it('fails when hook exists', function () {
			hm.hooks.existingHook = {
				resolver: noop,
				sync: true,
				hooks: []
			};

			return hm.addHook('existingHook', noop).then(expectError).catch(error => {
				expect(error.message).to.equal('Hook existingHook is already registered');
				expect(error.code).to.equal('EHOOKEXISTS');
			});
		});
	});

	describe('generateHookRegisterer', function () {
		let registerer;
		beforeEach(function () {
			registerer = hm.generateHookRegisterer();
		});

		it('returns a function', function () {
			expect(registerer).to.be.a('function');
		});

		it('fails with nonexistent hooks', function () {
			registerer('nonexistentHook').then(expectError).catch(error => {
				expect(error.code).to.equal('ENOHOOK');
				expect(error.message).to.equal('Hook nonexistentHook doesn\'t exist');
			});
		});

		it('adds one Hook', function () {
			const fn = sinon.stub();
			hm.addHook('test', noop).then(() => {
				expect(hm.hooks.test.hooks).to.have.lengthOf(0);
				return registerer('test', fn);
			}).then(() => {
				expect(hm.hooks.test).to.be.ok;
				expect(hm.hooks.test.hooks).to.have.lengthOf(1);
				expect(hm.hooks.test.hooks[0]).to.be.instanceof(Hook);
				expect(hm.hooks.test.hooks[0].fn).to.equal(fn);
				expect(hm.hooks.test.hooks[0].caller).to.equal('default');
			});
		});

		it('passes caller to Hook', function () {
			const fn = sinon.stub();
			hm.addHook('test', noop).then(() => {
				expect(hm.hooks.test.hooks).to.have.lengthOf(0);
				return hm.generateHookRegisterer('hookit-test')('test', fn);
			}).then(() => {
				expect(hm.hooks.test).to.be.ok;
				expect(hm.hooks.test.hooks).to.have.lengthOf(1);
				expect(hm.hooks.test.hooks[0]).to.be.instanceof(Hook);
				expect(hm.hooks.test.hooks[0].fn).to.equal(fn);
				expect(hm.hooks.test.hooks[0].caller).to.equal('hookit-test');
			});
		});
	});

	describe('executeHook', function () {
		it('fails with nonexistent hooks', function () {
			hm.executeHook('doesNotExist').then(expectError).catch(error => {
				expect(error.code).to.equal('ENOHOOK');
			});
		});

		describe('sync hooks', function () {
			it('calls hooks in order with proper args', function () {
				// We're using the spread operator because a) it allows one line returns, and b)
				// it creates a new Array, meaning we can use stub.calledWithExactly(...)
				const hookA = sinon.stub().callsFake(a => [...a, 'hookA']);
				const hookB = sinon.stub().callsFake(a => [...a, 'hookB']);

				return hm.addHook('test', noop, true).then(() => {
					const register = hm.generateHookRegisterer('test');
					return register('test', hookA).then(() => register('test', hookB));
				}).then(() =>
					hm.executeHook('test', [], ['val'], 'argA', 'argB')
				).then(result => {
					expect(result).to.deep.equal(['val', 'hookA', 'hookB']);
					expect(hookA.calledOnce).to.be.true;
					expect(hookA.calledWithExactly(['val'], 'argA', 'argB')).to.be.true;
					expect(hookB.calledOnce).to.be.true;
					expect(hookB.calledWithExactly(['val', 'hookA'], 'argA', 'argB')).to.be.true;
				});
			});

			it('handles rejection', function () {
				const hookA = sinon.stub().rejects(new Error('obscureA'));
				const hookB = sinon.stub().throws(new Error('obscureB'));
				const hookC = sinon.stub().callsFake(a => [...a, 'hookB']);

				return hm.addHook('test', noop, true).then(() => {
					const register = hm.generateHookRegisterer('test');
					return register('test', hookA)
						.then(() => register('test', hookB))
						.then(() => register('test', hookC));
				}).then(() =>
					hm.executeHook('test', [], ['val'])
				).then(result => {
					expect(result).to.deep.equal(['val', 'hookB']);
					expect(hookA.calledOnce).to.be.true;
					expect(hookB.calledOnce).to.be.true;
					expect(hookC.calledOnce).to.be.true;
					expect(hookC.calledWithExactly(['val'])).to.be.true;
				});
			});

			it('calls resolver when finished', function () {
				const theHook = sinon.stub().rejects(new Error('obscure'));
				const resolver = sinon.stub();

				return hm.addHook('test', resolver, true).then(() =>
					hm.generateHookRegisterer('test')('test', theHook)
				).then(() =>
					hm.executeHook('test', ['hello', true], ['val'])
				).then(() => {
					expect(theHook.calledOnce).to.be.true;
					expect(resolver.calledOnce).to.be.true;
					expect(resolver.calledWithExactly(['val'], 'hello', true)).to.be.true;
				});
			});
		});

		describe('async hooks', function () {
			it('calls hooks in order with proper args', function () {
				const hookA = sinon.stub().resolves(['test']);
				const hookB = sinon.stub().returns(['hello']);

				return hm.addHook('test', noop).then(() =>
					hm.generateHookRegisterer()('test', hookA)
				).then(() =>
					hm.generateHookRegisterer('caller')('test', hookB)
				).then(() =>
					hm.executeHook('test', false, 'arg1', 'arg2')
				).then(results => {
					const expectedResults = [{
						from: 'default',
						result: ['test']
					}, {
						from: 'caller',
						result: ['hello']
					}];

					expect(results).to.deep.equal(expectedResults);
					expect(hookA.calledOnce).to.be.true;
					expect(hookA.calledWithExactly('arg1', 'arg2')).to.be.true;
					expect(hookB.calledOnce).to.be.true;
					expect(hookB.calledWithExactly('arg1', 'arg2')).to.be.true;
				});
			});

			it('handles rejection', function () {
				const hookA = sinon.stub().rejects(['test']);
				const hookB = sinon.stub().throws(new Error('hello'));

				return hm.addHook('test', noop).then(() =>
					hm.generateHookRegisterer()('test', hookA)
				).then(() =>
					hm.generateHookRegisterer('caller')('test', hookB)
				).then(() =>
					hm.executeHook('test', [], 'arg1', 'arg2')
				).then(results => {
					expect(results).to.deep.equal([]);
					expect(hookA.calledOnce).to.be.true;
					expect(hookB.calledOnce).to.be.true;
				});
			});

			it('calls resolver when finished', function () {
				const theHook = sinon.stub().rejects(new Error('obscure'));
				const resolver = sinon.stub();

				return hm.addHook('test', resolver).then(() =>
					hm.generateHookRegisterer('test')('test', theHook)
				).then(() =>
					hm.executeHook('test', false, 'hookArg')
				).then(() => {
					expect(theHook.calledOnce).to.be.true;
					expect(theHook.calledWithExactly('hookArg')).to.be.true;
					expect(resolver.calledOnce).to.be.true;
					expect(resolver.calledWithExactly([])).to.be.true;
				});
			});
		});
	});
});

/* eslint-enable max-nested-callbacks */