import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';

beforeEach(async () => {
  await initDb('/tmp/test-search-routes.db');
});

afterEach(() => {
  closeDb();
  const fs = require('fs');
  try {
    fs.unlinkSync('/tmp/test-search-routes.db');
  } catch (e) {
    // ignore
  }
});

describe('GET /api/books/search', () => {
  describe('AC1: matches title or author, partial, case-insensitive', () => {
    it('AC1: "pragmatic" returns The Pragmatic Programmer', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'pragmatic' });
      expect(res.status).toBe(200);
      expect(res.body.map((b: any) => b.title)).toContain('The Pragmatic Programmer');
    });

    it('AC1: "KNUTH" (uppercase) returns The Art of Computer Programming', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'KNUTH' });
      expect(res.status).toBe(200);
      expect(res.body.map((b: any) => b.title)).toContain('The Art of Computer Programming');
    });

    it('AC1: mixed case query matches regardless of case', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'pRaGmAtIc' });
      expect(res.status).toBe(200);
      expect(res.body.map((b: any) => b.title)).toContain('The Pragmatic Programmer');
    });

    it('AC1: no-match query returns an empty array with status 200', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'zzzznonexistentbooktitle' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns Book objects with the same shape as GET /api/books', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'dune' });
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('title');
      expect(res.body[0]).toHaveProperty('author');
      expect(res.body[0]).toHaveProperty('isbn');
      expect(res.body[0]).toHaveProperty('cover_url');
      expect(res.body[0]).toHaveProperty('description');
      expect(res.body[0]).toHaveProperty('published_year');
      expect(res.body[0]).toHaveProperty('created_at');
    });
  });

  describe('AC2: empty query returns all books', () => {
    it('AC2: q="" returns all 50 books, first title "1984"', async () => {
      const res = await request(app).get('/api/books/search').query({ q: '' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(50);
      expect(res.body[0].title).toBe('1984');
    });

    it('AC2: q missing returns all 50 books', async () => {
      const res = await request(app).get('/api/books/search');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(50);
      expect(res.body[0].title).toBe('1984');
    });

    it('AC2: q="   " (whitespace only) returns all 50 books', async () => {
      const res = await request(app).get('/api/books/search').query({ q: '   ' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(50);
    });

    it('AC2: order is identical to GET /api/books', async () => {
      const all = await request(app).get('/api/books');
      const search = await request(app).get('/api/books/search').query({ q: '' });
      expect(search.body.map((b: any) => b.id)).toEqual(all.body.map((b: any) => b.id));
    });
  });

  describe('AC3: input is trimmed; over 100 characters returns a validation error', () => {
    it('AC3: "  dune  " returns the same results as "dune"', async () => {
      const padded = await request(app).get('/api/books/search').query({ q: '  dune  ' });
      const trimmed = await request(app).get('/api/books/search').query({ q: 'dune' });
      expect(padded.status).toBe(200);
      expect(padded.body.map((b: any) => b.id)).toEqual(trimmed.body.map((b: any) => b.id));
    });

    it('AC3: exactly 100 characters returns 200', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'a'.repeat(100) });
      expect(res.status).toBe(200);
    });

    it('AC3: 101 characters returns 400 with { error } mentioning 100', async () => {
      const res = await request(app).get('/api/books/search').query({ q: 'a'.repeat(101) });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('100');
    });

    it('AC3: 100 characters surrounded by spaces returns 200 (trim before length check)', async () => {
      const res = await request(app)
        .get('/api/books/search')
        .query({ q: `  ${'a'.repeat(100)}  ` });
      expect(res.status).toBe(200);
    });
  });

  describe('AC4: SQL injection and wildcard safety', () => {
    it('AC4: "\' OR 1=1 --" returns [] with status 200, no error', async () => {
      const res = await request(app).get('/api/books/search').query({ q: "' OR 1=1 --" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('AC4: "%\' OR \'1\'=\'1" returns [] with status 200, no error', async () => {
      const res = await request(app).get('/api/books/search').query({ q: "%' OR '1'='1" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('AC4: a lone "%" matches literally, not all books', async () => {
      const res = await request(app).get('/api/books/search').query({ q: '%' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('AC4: a lone "_" matches literally, not all books', async () => {
      const res = await request(app).get('/api/books/search').query({ q: '_' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('q given more than once', () => {
    it('returns 400 with { error } when q is repeated (?q=a&q=b)', async () => {
      const res = await request(app).get('/api/books/search?q=a&q=b');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});

describe('GET /books/search (HTMX)', () => {
  it('— HTMX route: q=dune returns 200 HTML containing book-grid/book-card markup and "Dune"', async () => {
    const res = await request(app).get('/books/search').query({ q: 'dune' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('book-grid');
    expect(res.text).toContain('book-card');
    expect(res.text).toContain('Dune');
  });

  it('— HTMX route: 101 character query returns 400 with <p class="error"> fragment', async () => {
    const res = await request(app).get('/books/search').query({ q: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.text).toContain('<p class="error">');
  });

  it('— HTMX route: no matches renders an empty-state message ("no books found")', async () => {
    const res = await request(app).get('/books/search').query({ q: 'zzzznonexistentbooktitle' });
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('book-card');
    expect(res.text).toMatch(/no books found/i);
  });
});
