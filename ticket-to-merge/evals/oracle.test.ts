// Ground-truth oracle for the planted-bug eval. NOT given to reviewers.
// Run inside an eval worktree (see run-eval.sh --oracle): every test passes on clean-b,
// and exactly the planted-bug tests (B1-B4) fail on planted-a.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { unlinkSync } from 'fs';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Stats from '../../src/models/stats.js';
import * as User from '../../src/models/user.js';
import * as Review from '../../src/models/review.js';
import * as Book from '../../src/models/book.js';

const DB = '/tmp/oracle-eval.db';
beforeEach(async () => { await initDb(DB); });
afterEach(() => { closeDb(); try { unlinkSync(DB); } catch { /* ignore */ } });

describe('oracle', () => {
  it('B1: page 1 starts at the first book', () => {
    const first = Book.getAllBooks()[0];
    expect(Stats.getBooksPage(1, 5)[0].id).toBe(first.id);
  });
  it('B2: sort parameter cannot inject SQL', async () => {
    // Raw input reaching ORDER BY makes an unknown column a SQL error (500); a whitelist falls back (200).
    const res2 = await request(app).get('/api/books/1/reviews').query({ sort: 'nonexistent_column' });
    expect(res2.status).toBe(200);
  });
  it('B3: out-of-range rating is rejected with 400', async () => {
    const id = Review.getReviewsByBookId(1)[0].id;
    const res = await request(app).put(`/api/reviews/${id}/rating`).send({ rating: 6 });
    expect(res.status).toBe(400);
  });
  it('B4: reviewer display names are HTML-escaped', async () => {
    const u = User.createUser('mallory', '<img src=x onerror=alert(1)>');
    Review.createReview(u.id, 7, 5, 'x');
    const res = await request(app).get('/books/7/top-review');
    if (res.status === 404) return; // route absent in the clean control
    expect(res.text).not.toContain('<img src=x');
  });
  it('control: top, page validation, histogram and whitelisted sorts behave', async () => {
    expect((await request(app).get('/api/books/top').query({ limit: -5 })).body.length).toBeLessThanOrEqual(1);
    expect((await request(app).get('/api/books/page').query({ pageSize: 101 })).status).toBe(400);
    expect((await request(app).get('/api/books/page').query({ sort: 'constructor' })).status).toBe(200);
    const h = (await request(app).get('/api/books/1/histogram')).body;
    expect(Object.keys(h)).toEqual(['1', '2', '3', '4', '5']);
    expect((await request(app).get('/api/books/999/histogram')).status).toBe(404);
    expect((await request(app).put('/api/reviews/1/rating').send({ rating: 4 })).status).toBe(200);
  });
});
