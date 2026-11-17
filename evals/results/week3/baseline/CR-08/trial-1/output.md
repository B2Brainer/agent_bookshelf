I reviewed `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-KSgFUj/loan-utils.ts`. Note: per my role as a review-only agent, I'm not able to modify files (and I only have read-only tools available), so I'm reporting the finding with a recommended fix rather than applying it.

## Critical

**File:** `loan-utils.ts`, lines 13-16

```ts
/** A loan is overdue when the current time is past its due date. */
export function isOverdue(loan: Loan, now: Date = new Date()): boolean {
  return loan.dueAt.getTime() > now.getTime();
}
```

**Issue:** The comparison is inverted relative to both the doc comment and the intended semantics. "Overdue" means the current time is *past* (after) the due date, i.e. `now > dueAt`. The implementation instead returns `true` when `dueAt > now`, which means:
- A loan due in the future is incorrectly reported as overdue.
- A loan whose due date has actually passed is incorrectly reported as *not* overdue.

This is a correctness defect that would cause any caller (e.g., fine calculation, overdue notifications) to behave exactly backwards.

**Recommended fix:**
```ts
export function isOverdue(loan: Loan, now: Date = new Date()): boolean {
  return now.getTime() > loan.dueAt.getTime();
}
```
(Consider whether equality — `now.getTime() === dueAt.getTime()` — should count as overdue; current `>` comparison excludes the exact due-date instant, which seems reasonable but is worth confirming against requirements.)

## Minor / Maintainability

- `createLoan` (line 9-11) has no validation on `days` (e.g., negative or zero values would produce a `dueAt` before or equal to `borrowedAt`). Not necessarily a bug, but if negative loan periods are not a valid business case, consider guarding against it. This is speculative and not a confirmed defect given the limited scope of this file.

No other issues were identified in this file.