import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest, auditLog } from '../middleware/auth';
import { Role } from '@prisma/client';
import { DEFAULT_GRADING_SCALE } from '../services/gradingEngine';

const router = Router();
router.use(authenticate);

// ── GET /api/grading-scales ───────────────────────────────────────────────────
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const scales = await prisma.gradingScale.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: scales });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/grading-scales — replace entire scale ────────────────────────────
router.put('/', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      entries: z.array(z.object({
        grade: z.string().min(1).max(5),
        minPercent: z.number().min(0).max(100),
        gradePoint: z.number().min(0).max(10),
        remark: z.string().min(1).max(50),
      })).min(2),
    });
    const { entries } = schema.parse(req.body);

    // Validate: must have exactly one entry with minPercent 0 (the fail grade)
    const hasZero = entries.some((e) => e.minPercent === 0);
    if (!hasZero) {
      throw new AppError(400, 'Grading scale must include a grade with minPercent = 0 (the fail/lowest grade).', 'INVALID_SCALE');
    }

    // Sort descending by minPercent, assign sortOrder
    const sorted = entries
      .slice()
      .sort((a, b) => b.minPercent - a.minPercent)
      .map((e, i) => ({ ...e, sortOrder: i }));

    await prisma.$transaction([
      prisma.gradingScale.deleteMany(),
      ...sorted.map((e) => prisma.gradingScale.create({ data: e })),
    ]);

    await auditLog(req.user!.id, 'UPDATE_GRADING_SCALE', 'GradingScale', undefined, { entries: sorted }, req.ip);
    const updated = await prisma.gradingScale.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/grading-scales/reset ───────────────────────────────────────────
router.post('/reset', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sorted = DEFAULT_GRADING_SCALE
      .slice()
      .sort((a, b) => b.minPercent - a.minPercent)
      .map((e, i) => ({ ...e, sortOrder: i, isDefault: true }));

    await prisma.$transaction([
      prisma.gradingScale.deleteMany(),
      ...sorted.map((e) => prisma.gradingScale.create({ data: e })),
    ]);

    await auditLog(req.user!.id, 'RESET_GRADING_SCALE', 'GradingScale', undefined, undefined, req.ip);
    const updated = await prisma.gradingScale.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
