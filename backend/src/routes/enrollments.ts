import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      include: { student: true, semester: true, section: true },
    });
    res.json({ success: true, data: enrollments });
  } catch (err) { next(err); }
});

export default router;
