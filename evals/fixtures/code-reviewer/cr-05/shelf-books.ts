import { all, run, saveDb } from './db.js';

// sql.js keeps the database in memory.
// saveDb() writes the current state to disk.

export function getBooksOnShelf(shelfId: number): Record<string, unknown>[] {
  return all('SELECT book_id FROM shelf_books WHERE shelf_id = ?', [shelfId]);
}

export function removeBookFromShelf(shelfId: number, bookId: number): boolean {
  const result = run('DELETE FROM shelf_books WHERE shelf_id = ? AND book_id = ?', [shelfId, bookId]);
  saveDb();
  return result.changes > 0;
}

export function addBookToShelf(shelfId: number, bookId: number): boolean {
  const result = run('INSERT OR IGNORE INTO shelf_books (shelf_id, book_id) VALUES (?, ?)', [shelfId, bookId]);
  return result.changes > 0;
}

export function clearShelf(shelfId: number): number {
  const result = run('DELETE FROM shelf_books WHERE shelf_id = ?', [shelfId]);
  saveDb();
  return result.changes;
}
