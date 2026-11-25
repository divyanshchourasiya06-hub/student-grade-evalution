import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest, auditLog } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ── GET /api/marks ─────────────────────────────────────────────────────────────
// ?semesterId=&sectionId=&subjectId=
router.get('/', async (req, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      semesterId: z.string().optional(),
      subjectId: z.string().optional(),
      studentId: z.string().optional(),
    });
    const q = schema.parse(req.query);
    const where: any = {};
    if (q.semesterId) where.semesterId = q.semesterId;
    if (q.subjectId) where.subjectId = q.subjectId;
    if (q.studentId) where.studentId = q.studentId;

    const marks = await prisma.mark.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, enrollmentNumber: true } },
        subject: { select: { id: true, name: true, code: true, maxMarks: true, credits: true } },
      },
    });
    res.json({ success: true, data: marks });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/marks/sheet — full marks sheet for a semester+section ─────────────
// Returns rows of { student, marks: { subjectId: { obtained, markId } } }
router.get('/sheet', async (req, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      semesterId: z.string().cuid(),
      sectionId: z.string().cuid(),
    });
    const { semesterId, sectionId } = schema.parse(req.query);

    const [enrollments, subjects, allMarks] = await Promise.all([
      prisma.enrollment.findMany({
        where: { semesterId, sectionId },
        include: { student: { select: { id: true, fullName: true, enrollmentNumber: true } } },
      }),
      prisma.subject.findMany({
        where: { semesterId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.mark.findMany({
        where: {
          semesterId,
          studentId: { in: enrollments.map((e) => e.studentId) },
        },
      }),
    ]);

    const markMap = new Map<string, { obtained: number; markId: string }>();
    for (const m of allMarks) {
      markMap.set(`${m.studentId}:${m.subjectId}`, { obtained: m.obtained, markId: m.id });
    }

    const rows = enrollments.map((e) => ({
      student: e.student,
      marks: Object.fromEntries(
        subjects.map((s) => [
          s.id,
          markMap.get(`${e.studentId}:${s.id}`) ?? null,
        ])
      ),
    }));

    res.json({ success: true, data: { subjects, rows } });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/marks — upsert a single mark ─────────────────────────────────────
router.put('/', authorize(Role.ADMIN, Role.TEACHER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      studentId: z.string().cuid(),
      subjectId: z.string().cuid(),
      semesterId: z.string().cuid(),
      obtained: z.number().min(0),
    });
    const { studentId, subjectId, semesterId, obtained } = schema.parse(req.body);

    // Validate against max marks
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new AppError(404, 'Subject not found.', 'NOT_FOUND');
    if (obtained > subject.maxMarks) {
      throw new AppError(400, `Marks cannot exceed maximum marks (${subject.maxMarks}).`, 'INVALID_MARKS');
    }

    const mark = await prisma.mark.upsert({
      where: { studentId_subjectId_semesterId: { studentId, subjectId, semesterId } },
      update: { obtained, enteredBy: req.user!.id },
      create: { studentId, subjectId, semesterId, obtained, enteredBy: req.user!.id },
    });

    await auditLog(req.user!.id, 'UPSERT_MARK', 'Mark', mark.id, { studentId, subjectId, obtained }, req.ip);
    res.json({ success: true, data: mark });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/marks/bulk — bulk upsert ─────────────────────────────────────────
router.put('/bulk', authorize(Role.ADMIN, Role.TEACHER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      semesterId: z.string().cuid(),
      entries: z.array(z.object({
        studentId: z.string().cuid(),
        subjectId: z.string().cuid(),
        obtained: z.number().min(0),
      })).min(1).max(500),
    });
    const { semesterId, entries } = schema.parse(req.body);

    // Fetch all subjects for validation
    const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
    const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const errors: string[] = [];
    const valid = entries.filter((e) => {
      const sub = subjectMap.get(e.subjectId);
      if (!sub) { errors.push(`Unknown subject ${e.subjectId}`); return false; }
      if (e.obtained > sub.maxMarks) {
        errors.push(`${e.studentId}/${sub.code}: ${e.obtained} > max ${sub.maxMarks}`);
        return false;
      }
      return true;
    });

    // Upsert in transaction
    const results = await prisma.$transaction(
      valid.map((e) =>
        prisma.mark.upsert({
          where: { studentId_subjectId_semesterId: { studentId: e.studentId, subjectId: e.subjectId, semesterId } },
          update: { obtained: e.obtained, enteredBy: req.user!.id },
          create: { studentId: e.studentId, subjectId: e.subjectId, semesterId, obtained: e.obtained, enteredBy: req.user!.id },
        })
      )
    );

    await auditLog(req.user!.id, 'BULK_UPSERT_MARKS', 'Mark', undefined, { count: results.length, errors }, req.ip);
    res.json({ success: true, data: { saved: results.length, errors } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/marks/:id ─────────────────────────────────────────────────────
router.delete('/:id', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.mark.delete({ where: { id: req.params.id } });
    await auditLog(req.user!.id, 'DELETE_MARK', 'Mark', req.params.id, undefined, req.ip);
    res.json({ success: true, message: 'Mark deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
