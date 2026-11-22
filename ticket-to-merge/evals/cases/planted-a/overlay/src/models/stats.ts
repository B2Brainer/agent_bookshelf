import { all, get } from '../db/index.js';
import type { Book } from './book.js';
import type { ReviewWithDetails } from './review.js';

export interface RatedBook extends Book {
  avg_rating: number;
  review_count: number;
}

const BOOK_SORT_COLUMNS: Record<string, string> = {
  title: 'title',
  author: 'author',
  year: 'published_year',
};

// Books with at least `minReviews` reviews, best average first.
export function getTopRatedBooks(limit: number, minReviews: number): RatedBook[] {
  return all(`
    SELECT b.*, AVG(r.rating) AS avg_rating, COUNT(r.id) AS review_count
    FROM books b
    JOIN reviews r ON r.book_id = b.id
    GROUP BY b.id
    HAVING COUNT(r.id) >= ?
    ORDER BY avg_rating DESC, b.title
    LIMIT ?
  `, [minReviews, limit]) as unknown as RatedBook[];
}

// Paginated catalogue. `page` starts at 1.
export function getBooksPage(page: number, pageSize: number, sortKey = 'title'): Book[] {
  const column = Object.hasOwn(BOOK_SORT_COLUMNS, sortKey) ? BOOK_SORT_COLUMNS[sortKey] : 'title';
  return all(
    `SELECT * FROM books ORDER BY ${column}, id LIMIT ? OFFSET ?`,
    [pageSize, page * pageSize]
  ) as unknown as Book[];
}

// Reviews for a book, sorted by the caller's choice (e.g. "rating DESC").
export function getReviewsSorted(bookId: number, sort: string): ReviewWithDetails[] {
  return all(`
    SELECT r.*, u.username, u.display_name, b.title as book_title, b.author as book_author
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.book_id = ?
    ORDER BY ${sort}
  `, [bookId]) as unknown as ReviewWithDetails[];
}

// Count of reviews per star value, always returning all five buckets.
export function getRatingHistogram(bookId: number): Record<number, number> {
  const rows = all(
    'SELECT rating, COUNT(*) AS n FROM reviews WHERE book_id = ? GROUP BY rating',
    [bookId]
  ) as unknown as { rating: number; n: number }[];
  const histogram: Record<number, number> = {};
  for (let star = 1; star <= 5; star++) histogram[star] = 0;
  for (const row of rows) histogram[row.rating] = row.n;
  return histogram;
}

// Highest-rated review for a book, used by the book page summary.
export function getTopReview(bookId: number): ReviewWithDetails | undefined {
  return get(`
    SELECT r.*, u.username, u.display_name, b.title as book_title, b.author as book_author
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.book_id = ?
    ORDER BY r.rating DESC, r.created_at DESC
    LIMIT 1
  `, [bookId]) as unknown as ReviewWithDetails | undefined;
}
