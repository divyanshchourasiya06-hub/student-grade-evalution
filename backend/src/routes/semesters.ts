import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const semesters = await prisma.semester.findMany({ orderBy: { number: 'asc' } });
    res.json({ success: true, data: semesters });
  } catch (err) { next(err); }
});

export default router;
