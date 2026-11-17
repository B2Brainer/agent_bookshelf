import { all, get, run } from './db.js';

const PAGE_SIZE = 20;

export function listShelfBooks(shelfId: number, page: number): Record<string, unknown>[] {
  // Pages are 1-based: page 1 is the first page.
  const offset = page * PAGE_SIZE;
  return all(
    'SELECT b.* FROM books b JOIN shelf_books sb ON sb.book_id = b.id WHERE sb.shelf_id = ? LIMIT ? OFFSET ?',
    [shelfId, PAGE_SIZE, offset]
  );
}

export function moveBook(bookId: number, fromShelfId: number, toShelfId: number): boolean {
  run('DELETE FROM shelf_books WHERE shelf_id = ? AND book_id = ?', [fromShelfId, bookId]);

  const target = get('SELECT id FROM shelves WHERE id = ?', [toShelfId]);
  if (!target) {
    return false;
  }

  run('INSERT INTO shelf_books (shelf_id, book_id) VALUES (?, ?)', [toShelfId, bookId]);
  return true;
}

export function shelfLabel(name: string, count: number): string {
  const tmp = name.trim();
  return `${tmp} (${count})`;
}
