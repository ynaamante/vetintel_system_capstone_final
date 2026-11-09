const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Use the project's supported Node runtime without replacing the system Node.
const runtime = path.join(path.dirname(require.resolve('node/package.json')), 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
const result = spawnSync(runtime, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
