import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTitle, slugify, averageRating } from './format.js';

test('formatTitle joins title and author', () => {
  assert.equal(formatTitle(' Dune ', 'Frank Herbert'), 'Dune by Frank Herbert');
});

test('slugify produces url-safe slugs', () => {
  assert.equal(slugify('The Pragmatic Programmer!'), 'the-pragmatic-programmer');
});

test('averageRating returns the mean', () => {
  assert.equal(averageRating([4, 5, 3]), 4);
});

test('averageRating returns 0 for no ratings', () => {
  assert.equal(averageRating([]), 0);
});
