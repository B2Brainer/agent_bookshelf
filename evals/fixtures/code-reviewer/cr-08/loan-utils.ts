export interface Loan {
  bookId: number;
  borrowedAt: Date;
  dueAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createLoan(bookId: number, borrowedAt: Date, days = 14): Loan {
  return { bookId, borrowedAt, dueAt: new Date(borrowedAt.getTime() + days * DAY_MS) };
}

/** A loan is overdue when the current time is past its due date. */
export function isOverdue(loan: Loan, now: Date = new Date()): boolean {
  return loan.dueAt.getTime() > now.getTime();
}
