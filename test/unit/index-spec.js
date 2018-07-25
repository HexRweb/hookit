const {expect} = require('chai');

const HookManager = require('../../lib/hook-manager.js');
const Exported = require('../../index.js'); // eslint-disable-line unicorn/import-index

describe('Unit > Export', function () {
	it('Exports hook manager', function () {
		const exported = new Exported();
		expect(Exported).to.deep.equal(HookManager);
		expect(exported).to.be.instanceOf(HookManager);
	});
});

