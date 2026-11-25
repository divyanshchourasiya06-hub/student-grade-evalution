import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: { department: true, user: { select: { email: true } } },
    });
    res.json({ success: true, data: teachers });
  } catch (err) { next(err); }
});

export default router;
