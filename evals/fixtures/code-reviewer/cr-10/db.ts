// Database helpers backed by sql.js.
export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export declare function get(sql: string, params?: unknown[]): Record<string, unknown> | undefined;
export declare function all(sql: string, params?: unknown[]): Record<string, unknown>[];
export declare function run(sql: string, params?: unknown[]): RunResult;
export declare function saveDb(): void;
