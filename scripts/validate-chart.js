#!/usr/bin/env node
/**
 * Helm Chart Template Validation Script
 * Validates chart structure and template logic without requiring helm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const CHART_DIR = path.join(PROJECT_ROOT, 'charts/kube9-operator');
const TEMPLATES_DIR = path.join(CHART_DIR, 'templates');

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function error(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
}

function warning(msg) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

let hasErrors = false;

console.log('Helm Chart Structure Validation');
console.log('================================\n');

// Check Chart.yaml exists
console.log('Checking Chart.yaml...');
const chartYaml = path.join(CHART_DIR, 'Chart.yaml');
if (fs.existsSync(chartYaml)) {
  const content = fs.readFileSync(chartYaml, 'utf8');
  if (content.includes('apiVersion: v2')) {
    success('Chart.yaml exists and uses v2 API');
  } else {
    error('Chart.yaml does not use apiVersion: v2');
    hasErrors = true;
  }

  if (content.includes('name: kube9-operator')) {
    success('Chart name is correct');
  } else {
    error('Chart name is incorrect');
    hasErrors = true;
  }
} else {
  error('Chart.yaml not found');
  hasErrors = true;
}

// Check values.yaml exists
console.log('\nChecking values.yaml...');
const valuesYaml = path.join(CHART_DIR, 'values.yaml');
if (fs.existsSync(valuesYaml)) {
  const content = fs.readFileSync(valuesYaml, 'utf8');
  success('values.yaml exists');

  if (/\bapiKey\b/i.test(content) || content.includes('API_KEY')) {
    error('values.yaml must not define apiKey / API_KEY Helm surface');
    hasErrors = true;
  } else {
    success('values.yaml has no apiKey / API_KEY keys');
  }

  const requiredValues = [
    'image:',
    'resources:',
    'serviceAccount:',
    'rbac:',
    'logLevel:',
    'statusUpdateIntervalSeconds:',
  ];

  for (const value of requiredValues) {
    if (content.includes(value)) {
      success(`  Contains: ${value}`);
    } else {
      error(`  Missing: ${value}`);
      hasErrors = true;
    }
  }
} else {
  error('values.yaml not found');
  hasErrors = true;
}

// Check templates directory
console.log('\nChecking templates...');
if (!fs.existsSync(TEMPLATES_DIR)) {
  error('templates directory not found');
  hasErrors = true;
  process.exit(1);
}

const requiredTemplates = [
  '_helpers.tpl',
  'deployment.yaml',
  'serviceaccount.yaml',
  'role.yaml',
  'rolebinding.yaml',
  'clusterrole.yaml',
  'clusterrolebinding.yaml',
  'persistentvolumeclaim.yaml',
  'NOTES.txt'
];

const existingTemplates = fs.readdirSync(TEMPLATES_DIR);

for (const template of requiredTemplates) {
  if (existingTemplates.includes(template)) {
    success(`Template exists: ${template}`);
  } else {
    error(`Template missing: ${template}`);
    hasErrors = true;
  }
}

if (existingTemplates.includes('secret.yaml')) {
  error('secret.yaml must not exist (chart does not ship an API key Secret)');
  hasErrors = true;
} else {
  success('No secret.yaml template (expected)');
}

// Validate deployment.yaml
console.log('\nValidating deployment.yaml...');
const deploymentYaml = path.join(TEMPLATES_DIR, 'deployment.yaml');
if (fs.existsSync(deploymentYaml)) {
  const content = fs.readFileSync(deploymentYaml, 'utf8');

  if (content.includes('API_KEY')) {
    error('Deployment must not reference API_KEY');
    hasErrors = true;
  } else {
    success('Deployment has no API_KEY environment variable');
  }

  if (content.includes('apiKey') || content.includes('.Values.apiKey')) {
    error('Deployment must not reference apiKey values');
    hasErrors = true;
  } else {
    success('Deployment has no apiKey / .Values.apiKey references');
  }

  if (content.includes('secretKeyRef')) {
    error('Deployment must not use secretKeyRef for credentials from this chart');
    hasErrors = true;
  } else {
    success('Deployment has no secretKeyRef');
  }

  if (content.includes('/healthz') && content.includes('/readyz')) {
    success('Deployment includes health probes');
  } else {
    error('Deployment missing health probes');
    hasErrors = true;
  }
} else {
  error('deployment.yaml not found');
  hasErrors = true;
}

// Validate NOTES.txt
console.log('\nValidating NOTES.txt...');
const notesTxt = path.join(TEMPLATES_DIR, 'NOTES.txt');
if (fs.existsSync(notesTxt)) {
  const content = fs.readFileSync(notesTxt, 'utf8');
  const lower = content.toLowerCase();

  if (lower.includes('apikey') || content.includes('API_KEY')) {
    error('NOTES.txt must not reference apiKey / API_KEY');
    hasErrors = true;
  } else {
    success('NOTES.txt has no apiKey / API_KEY references');
  }

  if (content.includes('{{ .Chart.Name }}') || content.includes('{{ .Release.Name }}')) {
    success('NOTES.txt includes standard Helm placeholders');
  } else {
    warning('NOTES.txt may be missing expected Helm placeholders');
  }
} else {
  error('NOTES.txt not found');
  hasErrors = true;
}

// Validate helpers
console.log('\nValidating helper templates...');
const helpersTpl = path.join(TEMPLATES_DIR, '_helpers.tpl');
if (fs.existsSync(helpersTpl)) {
  const content = fs.readFileSync(helpersTpl, 'utf8');

  const requiredHelpers = [
    'kube9-operator.name',
    'kube9-operator.fullname',
    'kube9-operator.labels',
    'kube9-operator.selectorLabels',
    'kube9-operator.serviceAccountName'
  ];

  for (const helper of requiredHelpers) {
    if (content.includes(helper)) {
      success(`Helper exists: ${helper}`);
    } else {
      error(`Helper missing: ${helper}`);
      hasErrors = true;
    }
  }
} else {
  error('_helpers.tpl not found');
  hasErrors = true;
}

// Summary
console.log('\n================================');
if (hasErrors) {
  console.log(`${RED}Validation failed with errors${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}All validations passed!${RESET}`);
  console.log('\nNext steps:');
  console.log('  1. Run: helm lint charts/kube9-operator');
  console.log('  2. Run: helm template kube9-operator charts/kube9-operator');
  console.log('  3. Run: ./scripts/test-helm-chart.sh');
  process.exit(0);
}
