import { all, get, run, saveDb } from './db.js';

export interface Shelf {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

const MAX_SHELF_NAME_LENGTH = 50;

export function getShelvesByUser(userId: number): Shelf[] {
  return all('SELECT * FROM shelves WHERE user_id = ? ORDER BY name', [userId]) as unknown as Shelf[];
}

export function getShelfById(id: number): Shelf | undefined {
  return get('SELECT * FROM shelves WHERE id = ?', [id]) as unknown as Shelf | undefined;
}

export function createShelf(userId: number, name: string): Shelf {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SHELF_NAME_LENGTH) {
    throw new Error(`Shelf name must be between 1 and ${MAX_SHELF_NAME_LENGTH} characters`);
  }

  const result = run('INSERT INTO shelves (user_id, name) VALUES (?, ?)', [userId, trimmed]);
  saveDb();
  return getShelfById(result.lastInsertRowid)!;
}

export function deleteShelf(id: number, userId: number): boolean {
  const result = run('DELETE FROM shelves WHERE id = ? AND user_id = ?', [id, userId]);
  if (result.changes > 0) {
    saveDb();
  }
  return result.changes > 0;
}
