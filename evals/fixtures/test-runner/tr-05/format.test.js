import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTitle, slugify, averageRating } from './format.js';

test('formatTitle joins title and author', () => {
  assert.equal(formatTitle('Dune', 'Frank Herbert'), 'Dune by Frank Herbert');
});

test('formatTitle trims whitespace', () => {
  assert.equal(formatTitle('  Emma ', ' Jane Austen  '), 'Emma by Jane Austen');
});

test('slugify lowercases text', () => {
  assert.equal(slugify('DUNE'), 'dune');
});

test('slugify removes punctuation', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
});

test('averageRating returns the mean', () => {
  assert.equal(averageRating([2, 4]), 3);
});

test('averageRating returns 0 for no ratings', () => {
  assert.equal(averageRating([]), 0);
});

test('slugify keeps accented letters', () => {
  assert.equal(slugify('Café Society'), 'café-society');
});

test('averageRating ignores null ratings', () => {
  assert.equal(averageRating([5, null, 3]), 4);
});

test('formatTitle supports subtitles', { skip: 'subtitle support not implemented' }, () => {
  assert.equal(formatTitle('Dune: Messiah', 'Frank Herbert'), 'Dune: Messiah by Frank Herbert');
});

test('slugify handles emoji', { skip: true }, () => {
  assert.equal(slugify('Books 📚'), 'books');
});

test('averageRating weights recent reviews', { todo: 'pending product decision' });
