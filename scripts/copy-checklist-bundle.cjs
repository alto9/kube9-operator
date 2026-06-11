#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'src', 'ai-conformance', 'checklist');
const targetDir = path.join(projectRoot, 'dist', 'ai-conformance', 'checklist');

function copyRecursive(source, target) {
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(sourcePath, targetPath);
      continue;
    }

    if (entry.name.endsWith('.ts')) {
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Checklist source directory not found: ${sourceDir}`);
  process.exit(1);
}

copyRecursive(sourceDir, targetDir);
console.log(`Copied checklist bundle assets to ${targetDir}`);
