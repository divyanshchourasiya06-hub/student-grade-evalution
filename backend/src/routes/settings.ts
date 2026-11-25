import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const [totalStudents, totalSubjects, totalUsers] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.subject.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);
    res.json({ success: true, data: { totalStudents, totalSubjects, totalUsers } });
  } catch (err) { next(err); }
});

export default router;
