import { Router, Request, Response } from 'express';
import { searchBooks } from './book-search.js';

const router = Router();

router.get('/search', (req: Request, res: Response) => {
  const q = String(req.query.q ?? '');
  res.json(searchBooks(q));
});

export default router;
