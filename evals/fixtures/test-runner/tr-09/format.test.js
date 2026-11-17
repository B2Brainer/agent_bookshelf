import { writeFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTitle, slugify, averageRating } from './format.js';

// Record when the suite last ran.
writeFileSync(new URL('./.last-test-run', import.meta.url), new Date().toISOString());

test('formatTitle joins title and author', () => {
  assert.equal(formatTitle('Dune', 'Frank Herbert'), 'Dune by Frank Herbert');
});
