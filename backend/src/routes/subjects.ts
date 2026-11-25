import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest, auditLog } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ── GET /api/subjects ──────────────────────────────────────────────────────────
router.get('/', async (req, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      semesterId: z.string().optional(),
      departmentId: z.string().optional(),
      search: z.string().optional(),
    });
    const q = schema.parse(req.query);
    const where: any = { isActive: true };
    if (q.semesterId) where.semesterId = q.semesterId;
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const subjects = await prisma.subject.findMany({
      where,
      orderBy: [{ semester: { number: 'asc' } }, { name: 'asc' }],
      include: { semester: true, department: { select: { name: true, code: true } } },
    });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/subjects/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: { semester: true, department: true },
    });
    if (!subject) throw new AppError(404, 'Subject not found.', 'NOT_FOUND');
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subjects ────────────────────────────────────────────────────────
router.post('/', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(100),
      code: z.string().min(2).max(20).toUpperCase(),
      maxMarks: z.number().int().min(1).max(1000).default(100),
      credits: z.number().min(0).max(10),
      type: z.enum(['THEORY', 'PRACTICAL', 'PROJECT']).default('THEORY'),
      semesterId: z.string().cuid(),
      departmentId: z.string().cuid(),
    });
    const data = schema.parse(req.body);

    const subject = await prisma.subject.create({ data });
    await auditLog(req.user!.id, 'CREATE_SUBJECT', 'Subject', subject.id, { name: subject.name }, req.ip);
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/subjects/:id ───────────────────────────────────────────────────
router.patch('/:id', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(100).optional(),
      code: z.string().min(2).max(20).toUpperCase().optional(),
      maxMarks: z.number().int().min(1).max(1000).optional(),
      credits: z.number().min(0).max(10).optional(),
      type: z.enum(['THEORY', 'PRACTICAL', 'PROJECT']).optional(),
    });
    const data = schema.parse(req.body);

    const subject = await prisma.subject.update({ where: { id: req.params.id }, data });
    await auditLog(req.user!.id, 'UPDATE_SUBJECT', 'Subject', req.params.id, data, req.ip);
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/subjects/:id ──────────────────────────────────────────────────
router.delete('/:id', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const marksCount = await prisma.mark.count({ where: { subjectId: req.params.id } });
    if (marksCount > 0) {
      throw new AppError(
        409,
        `Cannot delete subject: ${marksCount} mark record(s) exist. Remove marks first or deactivate the subject.`,
        'HAS_MARKS'
      );
    }
    await prisma.subject.update({ where: { id: req.params.id }, data: { isActive: false } });
    await auditLog(req.user!.id, 'DELETE_SUBJECT', 'Subject', req.params.id, undefined, req.ip);
    res.json({ success: true, message: 'Subject deactivated.' });
  } catch (err) {
    next(err);
  }
});

export default router;
