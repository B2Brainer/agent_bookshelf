import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';

beforeEach(async () => {
  await initDb('/tmp/test-search-model.db');
});

afterEach(() => {
  closeDb();
  const fs = require('fs');
  try {
    fs.unlinkSync('/tmp/test-search-model.db');
  } catch (e) {
    // ignore
  }
});

describe('searchBooks', () => {
  describe('AC1: matches title or author, partial, case-insensitive', () => {
    it('AC1: title substring "pragmatic" returns The Pragmatic Programmer', () => {
      const results = Book.searchBooks('pragmatic');
      expect(results.map((b) => b.title)).toContain('The Pragmatic Programmer');
    });

    it('AC1: author substring "KNUTH" (mixed/upper case) returns The Art of Computer Programming', () => {
      const results = Book.searchBooks('KNUTH');
      expect(results.map((b) => b.title)).toContain('The Art of Computer Programming');
    });

    it('AC1: mixed case query matches regardless of case', () => {
      const results = Book.searchBooks('pRaGmAtIc');
      expect(results.map((b) => b.title)).toContain('The Pragmatic Programmer');
    });

    it('AC1: no-match query returns an empty array', () => {
      const results = Book.searchBooks('zzzznonexistentbooktitle');
      expect(results).toEqual([]);
    });
  });

  describe('AC2: empty query returns all books', () => {
    it('AC2: empty string q="" returns all 50 books ordered by title', () => {
      const results = Book.searchBooks('');
      expect(results).toHaveLength(50);
      expect(results[0].title).toBe('1984');
    });

    it('AC2: whitespace-only query returns all 50 books', () => {
      const results = Book.searchBooks('   ');
      expect(results).toHaveLength(50);
      expect(results[0].title).toBe('1984');
    });

    it('AC2: result order matches getAllBooks order', () => {
      const all = Book.getAllBooks();
      const searched = Book.searchBooks('');
      expect(searched.map((b) => b.id)).toEqual(all.map((b) => b.id));
    });
  });

  describe('AC3: input is trimmed; over 100 characters throws SearchValidationError', () => {
    it('AC3: "  dune  " returns the same results as "dune"', () => {
      const padded = Book.searchBooks('  dune  ');
      const trimmed = Book.searchBooks('dune');
      expect(padded.map((b) => b.id)).toEqual(trimmed.map((b) => b.id));
      expect(trimmed.map((b) => b.title)).toContain('Dune');
    });

    it('AC3: exactly 100 characters does not throw', () => {
      const query = 'a'.repeat(100);
      expect(() => Book.searchBooks(query)).not.toThrow();
    });

    it('AC3: 101 characters throws SearchValidationError mentioning 100', () => {
      const query = 'a'.repeat(101);
      expect(() => Book.searchBooks(query)).toThrow(Book.SearchValidationError);
      try {
        Book.searchBooks(query);
        expect.unreachable();
      } catch (err) {
        expect((err as Error).message).toContain('100');
      }
    });

    it('AC3: 100 characters surrounded by spaces does not throw (trim happens before length check)', () => {
      const query = `  ${'a'.repeat(100)}  `;
      expect(() => Book.searchBooks(query)).not.toThrow();
    });
  });

  describe('AC4: SQL is parameterised; wildcards match literally', () => {
    it('AC4: injection payload "\' OR 1=1 --" returns [] and does not throw', () => {
      expect(() => {
        const results = Book.searchBooks("' OR 1=1 --");
        expect(results).toEqual([]);
      }).not.toThrow();
    });

    it('AC4: injection payload "%\' OR \'1\'=\'1" returns [] and does not throw', () => {
      expect(() => {
        const results = Book.searchBooks("%' OR '1'='1");
        expect(results).toEqual([]);
      }).not.toThrow();
    });

    it('AC4: a lone "%" wildcard matches literally, not as "match everything"', () => {
      const results = Book.searchBooks('%');
      expect(results).toEqual([]);
    });

    it('AC4: a lone "_" wildcard matches literally, not as single-char match-anything', () => {
      const results = Book.searchBooks('_');
      expect(results).toEqual([]);
    });

    it('AC4: source check - searchBooks passes a plain SQL string (with ? placeholders) and a params array to all(), never interpolating the query into the SQL text', () => {
      const source = readFileSync(
        new URL('../../src/models/book.ts', import.meta.url),
        'utf-8'
      );
      const searchFnMatch = source.match(/export function searchBooks[\s\S]*?\n}/);
      expect(searchFnMatch).not.toBeNull();
      const fnBody = searchFnMatch![0];

      // Find the SQL string literal argument passed to all(...)
      const allCallMatch = fnBody.match(/all\(\s*(['"`])([\s\S]*?)\1\s*,\s*(\[[\s\S]*?\])\s*\)/);
      expect(allCallMatch).not.toBeNull();
      const [, , sqlText, paramsArgText] = allCallMatch!;

      // The SQL text itself must be a plain quoted string with `?` placeholders,
      // and must contain no template-literal substitutions (i.e. no `${...}`)
      expect(sqlText).toMatch(/\?/);
      expect(sqlText).not.toMatch(/\$\{/);

      // A params array must be passed alongside the SQL string
      expect(paramsArgText.trim().startsWith('[')).toBe(true);
    });
  });
});
