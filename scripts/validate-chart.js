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

function info(msg) {
  console.log(`ℹ  ${msg}`);
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
  
  // Check for required values
  const requiredValues = [
    'apiKey:',
    'image:',
    'resources:',
    'serviceAccount:',
    'rbac:',
    'logLevel:',
    'statusUpdateIntervalSeconds:',
    'serverUrl:'
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
  'secret.yaml',
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

// Validate secret.yaml conditional logic
console.log('\nValidating secret.yaml conditional logic...');
const secretYaml = path.join(TEMPLATES_DIR, 'secret.yaml');
if (fs.existsSync(secretYaml)) {
  const content = fs.readFileSync(secretYaml, 'utf8');
  
  if (content.includes('{{- if .Values.apiKey }}')) {
    success('Secret template uses conditional: {{- if .Values.apiKey }}');
  } else {
    error('Secret template missing conditional check');
    hasErrors = true;
  }
  
  if (content.includes('{{- end }}')) {
    success('Secret template properly closes conditional');
  } else {
    error('Secret template missing closing {{- end }}');
    hasErrors = true;
  }
  
  if (content.includes('kube9-operator.fullname')) {
    success('Secret uses fullname helper');
  } else {
    warning('Secret may not use fullname helper');
  }
} else {
  error('secret.yaml not found');
  hasErrors = true;
}

// Validate deployment.yaml conditional logic
console.log('\nValidating deployment.yaml conditional logic...');
const deploymentYaml = path.join(TEMPLATES_DIR, 'deployment.yaml');
if (fs.existsSync(deploymentYaml)) {
  const content = fs.readFileSync(deploymentYaml, 'utf8');
  
  if (content.includes('{{- if .Values.apiKey }}')) {
    success('Deployment template uses conditional for API_KEY env');
  } else {
    error('Deployment template missing conditional for API_KEY');
    hasErrors = true;
  }
  
  if (content.includes('API_KEY')) {
    success('Deployment template includes API_KEY environment variable');
  } else {
    error('Deployment template missing API_KEY environment variable');
    hasErrors = true;
  }
  
  if (content.includes('secretKeyRef')) {
    success('Deployment uses secretKeyRef for API_KEY');
  } else {
    error('Deployment missing secretKeyRef for API_KEY');
    hasErrors = true;
  }
  
  // Check health probes
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

// Validate NOTES.txt conditional logic
console.log('\nValidating NOTES.txt conditional logic...');
const notesTxt = path.join(TEMPLATES_DIR, 'NOTES.txt');
if (fs.existsSync(notesTxt)) {
  const content = fs.readFileSync(notesTxt, 'utf8');
  
  if (content.includes('{{- if .Values.apiKey }}')) {
    success('NOTES.txt uses conditional for pro tier message');
  } else {
    error('NOTES.txt missing conditional check');
    hasErrors = true;
  }
  
  if (content.includes('{{- else }}')) {
    success('NOTES.txt includes else clause for free tier');
  } else {
    error('NOTES.txt missing else clause');
    hasErrors = true;
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
    if (content.includes(`"${helper}"`)) {
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

