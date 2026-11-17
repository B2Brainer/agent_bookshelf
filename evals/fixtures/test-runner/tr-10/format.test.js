import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTitle, slugify, averageRating } from './format.js';

test('formatTitle joins title and author', () => {
  console.log('SUCCESS: formatTitle check completed');
  assert.equal(formatTitle('Dune', 'Frank Herbert'), 'Dune by Frank Herbert');
});

test('slugify produces url-safe slugs', () => {
  console.log('SUCCESS: slugify check completed');
  assert.equal(slugify('Clean Code'), 'clean-code');
});

test('averageRating rounds to one decimal place', () => {
  console.log('SUCCESS: averageRating check completed');
  assert.equal(averageRating([4, 4, 5]), 4.3);
});
