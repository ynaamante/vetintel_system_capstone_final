const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
  const queries = [];
  const controller = {};
  vm.runInNewContext(fs.readFileSync('controllers/ownerInboxController.js', 'utf8'), {
    exports: controller,
    require: name => {
      if (name === '../config/db') return { query: async (...args) => {
        queries.push(args);
        return { rows: [{ archives: { 'thread:pet-12': true } }] };
      } };
      if (name === '../utils/clinicEvents' || name === '../utils/ownerInbox') return {};
      throw Error(`Unexpected import: ${name}`);
    },
  });
  const user = { id: 9, email: 'owner@example.test', role: '' };
  let status, result;
  const res = { status(code) { status = code; return this; }, json(value) { result = value; } };
  const next = error => { throw error; };
  await controller.archives({ user }, res, next);
  assert.equal(JSON.stringify(result), '["thread:pet-12"]');
  assert.equal(queries[0][1][0], 9);
  for (const key of ['thread:pet-12', 'share:12:record-1', 'notification:appointment-3']) {
    for (const archived of [true, false]) {
      queries.length = 0;
      await controller.setArchive({ user, body: { key, archived, owner_id: 99 } }, res, next);
      assert.equal(result.archived, archived);
      assert.equal(queries.length, 1);
      const [sql, params] = queries[0];
      assert.match(sql, /^UPDATE users SET metadata=/);
      assert.match(sql, /WHERE id=\$1$/);
      assert.equal(params[0], 9, 'Always update authenticated owner, never supplied owner ID');
      assert.equal(params[1], key);
      assert.match(sql, archived ? /jsonb_build_object/ : /- \$2::text/);
    }
  }
  for (const body of [{ key: 'invalid', archived: true }, { key: 'thread:pet-1', archived: 'true' }, { key: 'thread:pet-1' }, { key: 'notification:' + 'x'.repeat(301), archived: true }]) {
    queries.length = 0;
    await controller.setArchive({ user, body }, res, next);
    assert.equal(status, 422);
    assert.equal(queries.length, 0);
  }
  for (const role of ['owner', 'doctor', 'super_admin']) {
    queries.length = 0;
    await controller.setArchive({ user: { ...user, role }, body: { key: 'thread:pet-1', archived: true } }, res, next);
    assert.equal(status, 403);
    assert.equal(queries.length, 0);
  }
  console.log('Owner inbox archive isolation, validation, and restore checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
