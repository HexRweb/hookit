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
			hm.addHook('testHook', true, resolver);

			expect(hm.hooks.testHook).to.be.ok;
			expect(hm.hooks.testHook.sync).to.be.true;
			expect(hm.hooks.testHook.hooks).to.be.an('array').but.empty;
			expect(hm.hooks.testHook.resolver).to.equal(resolver);
		});

		it('fails when hook exists', function () {
			hm.hooks.existingHook = {
				resolver: noop,
				sync: true,
				hooks: []
			};

			try {
				hm.addHook('existingHook');
				expectError();
			} catch (error) {
				expect(error.message).to.equal('Hook existingHook is already registered');
				expect(error.code).to.equal('EHOOKEXISTS');
			}
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
			try {
				registerer('nonexistentHook');
				expectError();
			} catch (error) {
				expect(error.code).to.equal('ENOHOOK');
				expect(error.message).to.equal('Hook nonexistentHook doesn\'t exist');
			}
		});

		it('adds one Hook', function () {
			const fn = sinon.stub();
			hm.addHook('test');
			expect(hm.hooks.test.hooks).to.be.empty;
			registerer('test', fn);

			expect(hm.hooks.test).to.be.ok;
			expect(hm.hooks.test.hooks).to.have.length(1);
			expect(hm.hooks.test.hooks[0]).to.be.instanceof(Hook);
			expect(hm.hooks.test.hooks[0].fn).to.equal(fn);
			expect(hm.hooks.test.hooks[0].caller).to.equal('default');
		});

		it('passes caller to Hook', function () {
			const fn = sinon.stub();
			hm.addHook('test');
			expect(hm.hooks.test.hooks).to.be.empty;
			hm.generateHookRegisterer('hookit-test')('test', fn);

			expect(hm.hooks.test).to.be.ok;
			expect(hm.hooks.test.hooks).to.have.length(1);
			expect(hm.hooks.test.hooks[0]).to.be.instanceof(Hook);
			expect(hm.hooks.test.hooks[0].fn).to.equal(fn);
			expect(hm.hooks.test.hooks[0].caller).to.equal('hookit-test');
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

				hm.addHook('test', true);
				const register = hm.generateHookRegisterer();
				register('test', hookA);
				register('test', hookB);

				return hm.executeHook('test', [], ['val'], 'argA', 'argB').then(result => {
					expect(result.errors).to.be.an('Array').but.empty;
					expect(result.results).to.deep.equal(['val', 'hookA', 'hookB']);
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

				hm.addHook('test', true);
				const register = hm.generateHookRegisterer();

				register('test', hookA);
				register('test', hookB);
				register('test', hookC);

				return hm.executeHook('test', [], ['val']).then(result => {
					expect(result.errors).to.be.an('Array').with.length(2);
					expect(result.errors[0].message).to.equal('obscureA');
					expect(result.errors[1].message).to.equal('obscureB');
					expect(result.results).to.deep.equal(['val', 'hookB']);
					expect(hookA.calledOnce).to.be.true;
					expect(hookB.calledOnce).to.be.true;
					expect(hookC.calledOnce).to.be.true;
					expect(hookC.calledWithExactly(['val'])).to.be.true;
				});
			});

			it('calls resolver when finished', function () {
				const error = new Error('obscure');
				const theHook = sinon.stub().rejects(error);
				const resolver = sinon.stub();

				hm.addHook('test', true, resolver);
				hm.generateHookRegisterer()('test', theHook);

				return hm.executeHook('test', ['hello', true], ['val']).then(() => {
					expect(theHook.calledOnce).to.be.true;
					expect(resolver.calledOnce).to.be.true;
					expect(resolver.calledWithExactly({errors: [error], results: ['val']}, 'hello', true)).to.be.true;
				});
			});
		});

		describe('async hooks', function () {
			it('calls hooks in order with proper args', function () {
				const hookA = sinon.stub().resolves(['test']);
				const hookB = sinon.stub().returns(['hello']);

				hm.addHook('test');
				hm.generateHookRegisterer()('test', hookA);
				hm.generateHookRegisterer('caller')('test', hookB);

				return hm.executeHook('test', false, 'arg1', 'arg2').then(results => {
					expect(results.errors).to.be.an('Array').but.empty;
					const expectedResults = [{
						from: 'default',
						result: ['test']
					}, {
						from: 'caller',
						result: ['hello']
					}];

					expect(results.results).to.deep.equal(expectedResults);
					expect(hookA.calledOnce).to.be.true;
					expect(hookA.calledWithExactly('arg1', 'arg2')).to.be.true;
					expect(hookB.calledOnce).to.be.true;
					expect(hookB.calledWithExactly('arg1', 'arg2')).to.be.true;
				});
			});

			it('handles rejection', function () {
				const hookA = sinon.stub().rejects(['test']);
				const hookB = sinon.stub().throws(new Error('hello'));

				hm.addHook('test');
				hm.generateHookRegisterer()('test', hookA);
				hm.generateHookRegisterer('caller')('test', hookB);

				return hm.executeHook('test', [], 'arg1', 'arg2').then(results => {
					expect(results.errors).to.be.an('Array').with.length(2);
					expect(results.results).to.be.an('Array').but.empty;
					expect(hookA.calledOnce).to.be.true;
					expect(hookB.calledOnce).to.be.true;
				});
			});

			it('calls resolver when finished', function () {
				const error = new Error('obscure');
				const theHook = sinon.stub().rejects(error);
				const resolver = sinon.stub();

				hm.addHook('test', false, resolver);
				hm.generateHookRegisterer()('test', theHook);

				return hm.executeHook('test', false, 'hookArg').then(() => {
					expect(theHook.calledOnce).to.be.true;
					expect(theHook.calledWithExactly('hookArg')).to.be.true;
					expect(resolver.calledOnce).to.be.true;
					expect(resolver.calledWithExactly({errors: [error], results: []})).to.be.true;
				});
			});
		});

		it('returns resolver results', function () {
			const FRUITS = ['apples', 'oranges', 'grapes'];
			const theHook = sinon.stub().returns(FRUITS);
			const resolver = ({errors, results: fruits}) => {
				expect(errors).to.be.an('Array').but.empty;
				expect(fruits).to.be.an('Array');

				// eslint-disable-next-line unicorn/no-reduce
				return fruits.reduce((reduced, fruit) => {
					reduced[fruit] = `${fruit}!`;
					return reduced;
				}, {});
			};

			hm.addHook('test', true, resolver);
			hm.generateHookRegisterer()('test', theHook);

			return hm.executeHook('test', false, []).then(results => {
				expect(theHook.calledOnce).to.be.true;
				expect(results).to.be.an('object');
				FRUITS.forEach(fruit => {
					expect(results[fruit]).to.equal(`${fruit}!`);
				});
			});
		});
	});
});

/* eslint-enable max-nested-callbacks */
