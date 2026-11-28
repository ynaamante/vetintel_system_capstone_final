const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
  for (const role of [null, undefined, '', 'user', 'pet_owner', 'owner', 'doctor', 'receptionist', 'super_admin']) {
    const queries = [];
    const controller = {};
    vm.runInNewContext(fs.readFileSync('controllers/ownerInboxController.js', 'utf8'), {
      exports: controller,
      require: name => {
        if (name === '../config/db') return { query: async (...args) => { queries.push(args); return { rows: [] }; } };
        if (name === '../utils/clinicEvents') return { publish() {} };
        if (name === '../utils/ownerInbox') return {};
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    for (const method of ['list', 'create', 'update']) {
      queries.length = 0;
      let status = 200;
      const response = { status(code) { status = code; return this; }, json() {} };
      const request = { user: { id: 42, email: ' Owner@Example.test ', role }, body: {}, params: { id: 'invalid' } };
      await controller[method](request, response, error => { throw error; });
      const accepted = [null, undefined, '', 'user', 'pet_owner'].includes(role);
      assert.equal(status, accepted ? (method === 'list' ? 200 : 400) : 403, `${method}: ${role}`);
      if (accepted && method === 'list') assert.equal(queries[0][1][0], 'owner@example.test');
      else assert.equal(queries.length, 0);
    }
    for (const user of [{ email: 'owner@example.test', role }, { id: 42, email: '', role }, undefined]) {
      let status;
      await controller.list({ user }, { status(code) { status = code; return this; }, json() {} }, error => { throw error; });
      assert.equal(status, 403);
    }
  }
  console.log('Owner inbox identity checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
