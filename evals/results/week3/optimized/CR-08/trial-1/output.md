Review complete. Note: my role is limited to reviewing and reporting findings, not modifying files, so I have not applied a fix — the orchestrator/user should apply the correction below.

Findings in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-oOYxOS/loan-utils.ts`:

1. **Critical** — `loan-utils.ts:15`: `isOverdue` has the comparison inverted relative to its documented behavior. The docstring states "overdue when the current time is past its due date" (i.e., `now > dueAt`), but the code returns `loan.dueAt.getTime() > now.getTime()`, which is true when `dueAt` is in the future (not yet due) and false once the loan is actually overdue. This is a correctness defect that will cause overdue loans to be reported as not overdue, and vice versa.
   Recommended correction: `return now.getTime() > loan.dueAt.getTime();`

No other actionable findings.