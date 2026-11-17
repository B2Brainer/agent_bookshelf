import { run } from './db.js';

export function createReview(userId: number, bookId: number, rating: number, text: string | null): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5');
  }
  if (text !== null && text.length > 2000) {
    throw new Error('Review text must be at most 2000 characters');
  }
  const result = run(
    'INSERT INTO reviews (user_id, book_id, rating, review_text) VALUES (?, ?, ?, ?)',
    [userId, bookId, rating, text]
  );
  return result.lastInsertRowid;
}

export function updateReview(reviewId: number, rating: number, text: string | null): boolean {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5');
  }
  if (text !== null && text.length > 2000) {
    throw new Error('Review text must be at most 2000 characters');
  }
  const result = run('UPDATE reviews SET rating = ?, review_text = ? WHERE id = ?', [rating, text, reviewId]);
  return result.changes > 0;
}

export function importReview(userId: number, bookId: number, rating: number, text: string | null): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5');
  }
  if (text !== null && text.length > 2000) {
    throw new Error('Review text must be at most 2000 characters');
  }
  const result = run(
    'INSERT OR REPLACE INTO reviews (user_id, book_id, rating, review_text) VALUES (?, ?, ?, ?)',
    [userId, bookId, rating, text]
  );
  return result.lastInsertRowid;
}
