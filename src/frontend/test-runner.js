// Custom test runner for Bun to ensure setup is loaded before tests

import './setupTests.ts';
import { glob } from 'bun';

// Find all test files
const testFiles = await glob('**/*.test.ts');

// Run each test file
for (const file of testFiles) {
  console.log(`Running tests in ${file}`);
  await import(`./${file}`);
} 