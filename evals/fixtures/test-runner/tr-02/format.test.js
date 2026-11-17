import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTitle, slugify, averageRating } from './format.js';

test('formatTitle joins title and author', () => {
  assert.equal(formatTitle('Dune', 'Frank Herbert'), 'Dune by Frank Herbert');
});

test('slugify produces url-safe slugs', () => {
  assert.equal(slugify('Clean Code'), 'clean-code');
});

test('averageRating rounds to one decimal place', () => {
  assert.equal(averageRating([4, 4, 5]), 4.3);
});
