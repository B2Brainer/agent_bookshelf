import { all } from './db.js';

export interface BookSummary {
  id: number;
  title: string;
  author: string;
}

export function searchBooks(query: string): BookSummary[] {
  const sql = `SELECT id, title, author FROM books WHERE title LIKE '%${query}%' OR author LIKE '%${query}%' ORDER BY title`;
  return all(sql) as unknown as BookSummary[];
}

export function booksByAuthor(author: string): BookSummary[] {
  return all('SELECT id, title, author FROM books WHERE author = ? ORDER BY title', [author]) as unknown as BookSummary[];
}
