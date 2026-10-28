const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const EMAIL = 'admin@vetintel.com';

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = function (s) {
      if (rl.stdoutMuted) rl.output.write('*');
      else rl.output.write(s);
    };
    rl.question(question, (answer) => { rl.close(); console.log(''); resolve(answer); });
    rl.stdoutMuted = true;
  });
}

(async () => {
  try {
    const first = await askHidden('New super admin password (min 14 characters): ');
    if (first.length < 14) throw new Error('Password must be at least 14 characters.');
    const second = await askHidden('Type it again to confirm: ');
    if (first !== second) throw new Error('The two passwords do not match.');

    const hash = await bcrypt.hash(first, 10);
    const result = await db.query(
      `update users
          set password_hash = $1, must_change_password = false, updated_at = now()
        where lower(email) = lower($2)
        returning id, email`,
      [hash, EMAIL]
    );
    if (result.rowCount === 0) throw new Error('No account found for ' + EMAIL);
    console.log('Password updated for', result.rows[0].email);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();