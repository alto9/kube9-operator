import { existsSync } from 'node:fs';

if (process.env.HUSKY === '0' || process.env.CI || process.env.NODE_ENV === 'production') {
  process.exit(0);
}

if (!existsSync('.git')) {
  process.exit(0);
}

try {
  const { default: husky } = await import('husky');
  husky();
} catch {
  process.exit(0);
}
