## Code Review: user-admin.ts

Scope: `user-admin.ts` (reviewed against `db.ts` helper signatures).

### Critical

1. **Assignment instead of comparison in `canDeleteUsers`** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:11`
   ```ts
   if (user.role = 'admin') {
   ```
   This is `=` (assignment), not `==`/`===`. It unconditionally sets `user.role` to `'admin'` and the assignment expression evaluates truthy, so `canDeleteUsers` **always returns `true`** regardless of the actual caller's role. This is a privilege-escalation bug: any user, including non-admins, can delete users.
   Fix: `if (user.role === 'admin')`.

2. **Unscoped delete wipes the entire table** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:21-23`
   ```ts
   if (userId === undefined) {
     run('DELETE FROM users');
     return;
   }
   ```
   When `userId` is omitted (e.g., the caller forgets the optional parameter, or it's `undefined` due to an upstream bug), this silently deletes **all rows** in `users`. Combined with finding #1 (role check always passing), this means any caller can trivially wipe the whole user table. Even once #1 is fixed, this is a dangerous implicit behavior for an optional parameter — a typo or missed argument becomes a mass-deletion. Recommend requiring `userId` (make it mandatory) or exposing a clearly separate, explicitly named function (e.g., `deleteAllUsers`) instead of overloading `deleteUser` via `undefined`.

### High

3. **`getUser` return type lies about nullability** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:33-35`
   ```ts
   export function getUser(id: number): User {
     return get('SELECT * FROM users WHERE id = ?', [id]) as unknown as User;
   }
   ```
   `db.ts` declares `get` as returning `Record<string, unknown> | undefined`. When no row matches, this function returns `undefined` at runtime but the type system claims it returns `User`. Callers relying on the type will dereference `undefined` and crash, or worse, silently propagate bad data (e.g., into `canDeleteUsers`/`deleteUser` for an actor lookup). The `as unknown as User` cast masks this. Fix: change the signature to `User | undefined` and have callers handle the missing case.

### Medium

4. **`countUsers` fetches all rows/columns just to count them** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:37-40`
   ```ts
   const rows = all('SELECT * FROM users');
   return rows.length;
   ```
   This pulls every column of every row into memory for a simple count, which is wasteful and will scale poorly. Prefer `SELECT COUNT(*) AS count FROM users` and read the scalar via `get`.

5. **Redundant/loose boolean comparison** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:49`
   ```ts
   return /^[a-z0-9_]{3,30}$/.test(name) == true;
   ```
   `.test()` already returns a boolean; comparing with `== true` is redundant and uses loose equality (inconsistent with best practice and with strict typing elsewhere in the file). Simplify to `return /^[a-z0-9_]{3,30}$/.test(name);`.

6. **Inconsistent variable declaration style** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:29`
   ```ts
   var results = all(...) as unknown as User[];
   ```
   Every other function in the file uses `const`. The lone `var` is inconsistent with file convention and with idiomatic modern TypeScript (no reassignment occurs, so `const` is appropriate).

### Low

7. **Silent no-op on empty `displayName`** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:42-46`
   `renameUser` silently does nothing if `displayName.length === 0`, giving the caller no feedback that the rename failed. Consider throwing (consistent with `deleteUser`'s `Forbidden` error pattern) so misuse is observable rather than silently swallowed.

8. **Magic string role check** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-fUgWJu/user-admin.ts:11`
   `'admin'` is a bare string literal with no shared constant/enum/type (`role: string` is unconstrained). Low risk currently but worth tightening (e.g., a `Role` union type) to avoid future typos replicating the class of bug found in #1.

No issues found with SQL injection handling — all queries in this file correctly use parameterized placeholders (`?`) rather than string interpolation.