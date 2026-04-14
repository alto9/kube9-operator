/**
 * Runs `husky` only when the husky devDependency is present (e.g. after `npm ci`
 * without --omit=dev). Skips silently in production installs and Docker, where
 * `prepare` would otherwise run `husky` and fail with exit 127.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const huskyDir = path.join(root, 'node_modules', 'husky');
if (!fs.existsSync(huskyDir)) {
  process.exit(0);
}

const binDir = path.join(root, 'node_modules', '.bin');
const env = {
  ...process.env,
  PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
};

execSync('husky', { stdio: 'inherit', cwd: root, env });
