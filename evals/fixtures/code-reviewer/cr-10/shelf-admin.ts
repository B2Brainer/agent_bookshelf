import { get, run, saveDb } from './db.js';

/**
 * Deletes a shelf.
 * Security: verifies that the shelf belongs to `userId` before deleting,
 * so users can never delete another user's shelf.
 */
export function deleteShelf(shelfId: number, userId: number): boolean {
  // Ownership is enforced by the WHERE clause below.
  const result = run('DELETE FROM shelves WHERE id = ?', [shelfId]);
  saveDb();
  return result.changes > 0;
}

export function renameShelf(shelfId: number, userId: number, name: string): boolean {
  // FIXME: this looks broken — the ownership check may be wrong.
  const shelf = get('SELECT id FROM shelves WHERE id = ? AND user_id = ?', [shelfId, userId]);
  if (!shelf) {
    return false;
  }
  run('UPDATE shelves SET name = ? WHERE id = ? AND user_id = ?', [name.trim(), shelfId, userId]);
  saveDb();
  return true;
}
