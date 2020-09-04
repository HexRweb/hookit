const sinon = require('sinon');
const {expect} = require('chai');
const Hook = require('../../lib/hook');
const noop = require('../utils/noop');
const expectError = require('../utils/expect-error');

describe('Unit > Hook', function () {
	it('constructs', function () {
		const hookA = new Hook(noop);
		const hookB = new Hook(noop, 'test');
		expect(hookA.fn).to.equal(noop);
		expect(hookA.caller).to.equal('default');
		expect(hookB.fn).to.equal(noop);
		expect(hookB.caller).to.equal('test');
	});

	describe('executeSync', function () {
		it('passes args to fn', function () {
			const fn = sinon.stub().returns('hello');
			const hook = new Hook(fn);

			return hook.executeSync('testing', 'the', ['hook', 'method']).then(result => {
				expect(result).to.equal('hello');
				expect(fn.calledOnce).to.be.true;
				expect(fn.calledWithExactly('testing', 'the', ['hook', 'method'])).to.be.true;
			});
		});

		it('handles errors / rejections', function () {
			const fnA = sinon.stub().throws(new Error('thrown'));
			const fnB = sinon.stub().rejects(new Error('rejected'));
			const hookA = new Hook(fnA);
			const hookB = new Hook(fnB);

			return hookA.executeSync().then(expectError).catch(error => {
				expect(error.message).to.equal('thrown');
			}).then(() => hookB.executeSync()).then(expectError).catch(error => {
				expect(error.message).to.equal('rejected');
			});
		});
	});

	describe('execute', function () {
		it('calls executeSync and passses args', function () {
			const hook = new Hook(noop);
			hook.executeSync = sinon.stub().resolves();

			return hook.execute('testing', ['the', 'args']).then(() => {
				expect(hook.executeSync.calledOnce).to.be.true;
				expect(hook.executeSync.calledWithExactly('testing', ['the', 'args'])).to.be.true;
			});
		});

		it('keeps track of where the result is from', function () {
			const hook = new Hook(noop, 'unit-test');

			return hook.execute('noopPassThrough').then(result => {
				const expectedResults = {
					from: 'unit-test',
					result: ['noopPassThrough']
				};
				expect(result).that.deep.equal(expectedResults);
			});
		});
	});
});
