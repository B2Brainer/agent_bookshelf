import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTitle, slugify, averageRating } from './format.js';

test('formatTitle joins title and author', () => {
  assert.equal(formatTitle('Dune', 'Frank Herbert'), 'Dune by Frank Herbert');
});

test('slugify collapses separators', () => {
  assert.equal(slugify('War  and   Peace'), 'war_and_peace');
});
