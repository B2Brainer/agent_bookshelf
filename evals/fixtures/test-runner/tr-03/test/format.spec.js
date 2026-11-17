import assert from 'node:assert/strict';
import { formatTitle } from '../format.js';

describe('formatTitle', () => {
  it('joins title and author', () => {
    assert.equal(formatTitle('Dune', 'Frank Herbert'), 'Dune by Frank Herbert');
  });
});
