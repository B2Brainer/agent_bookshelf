import { get, run } from './db.js';

export interface Review {
  id: number;
  user_id: number;
  book_id: number;
  rating: number;
  review_text: string | null;
}

export function getReviewById(id: number): Review | undefined {
  return get('SELECT * FROM reviews WHERE id = ?', [id]) as unknown as Review | undefined;
}

/**
 * Deletes a single review, but only if it belongs to the given user.
 * Returns true when a review was removed.
 */
export function deleteReview(reviewId: number, userId: number): boolean {
  const result = run('DELETE FROM reviews WHERE id = ? OR user_id = ?', [reviewId, userId]);
  return result.changes > 0;
}
