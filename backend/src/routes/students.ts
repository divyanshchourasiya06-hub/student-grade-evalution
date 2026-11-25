import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest, auditLog } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ── GET /api/students ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(200).default(50),
      search: z.string().optional(),
      departmentId: z.string().optional(),
      semesterId: z.string().optional(),
      sectionId: z.string().optional(),
    });
    const q = schema.parse(req.query);
    const skip = (q.page - 1) * q.limit;

    const where: any = { isActive: true };
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { enrollmentNumber: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.semesterId || q.sectionId) {
      where.enrollments = {
        some: {
          ...(q.semesterId ? { semesterId: q.semesterId } : {}),
          ...(q.sectionId ? { sectionId: q.sectionId } : {}),
        },
      };
    }

    const [data, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { fullName: 'asc' },
        include: {
          department: { select: { name: true, code: true } },
          academicYear: { select: { label: true } },
          enrollments: { include: { semester: true, section: true } },
        },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      success: true,
      data,
      meta: { total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/students/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        academicYear: true,
        enrollments: { include: { semester: true, section: true } },
        marks: { include: { subject: true, semester: true } },
      },
    });
    if (!student) throw new AppError(404, 'Student not found.', 'NOT_FOUND');
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/students ────────────────────────────────────────────────────────
router.post('/', authorize(Role.ADMIN, Role.TEACHER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      enrollmentNumber: z.string().min(1).max(20),
      fullName: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().optional(),
      departmentId: z.string().cuid(),
      academicYearId: z.string().cuid(),
      admissionDate: z.coerce.date(),
      semesterId: z.string().cuid().optional(),
      sectionId: z.string().cuid().optional(),
    });
    const data = schema.parse(req.body);

    const student = await prisma.$transaction(async (tx) => {
      const s = await tx.student.create({
        data: {
          enrollmentNumber: data.enrollmentNumber,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          departmentId: data.departmentId,
          academicYearId: data.academicYearId,
          admissionDate: data.admissionDate,
        },
      });

      if (data.semesterId && data.sectionId) {
        await tx.enrollment.create({
          data: { studentId: s.id, semesterId: data.semesterId, sectionId: data.sectionId },
        });
      }

      return s;
    });

    await auditLog(req.user!.id, 'CREATE_STUDENT', 'Student', student.id, { name: student.fullName }, req.ip);
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/students/:id ───────────────────────────────────────────────────
router.patch('/:id', authorize(Role.ADMIN, Role.TEACHER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      fullName: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional().nullable(),
      enrollmentNumber: z.string().min(1).max(20).optional(),
      departmentId: z.string().cuid().optional(),
      academicYearId: z.string().cuid().optional(),
      admissionDate: z.coerce.date().optional(),
    });
    const data = schema.parse(req.body);

    const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Student not found.', 'NOT_FOUND');

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data,
    });

    await auditLog(req.user!.id, 'UPDATE_STUDENT', 'Student', req.params.id, { before: existing, after: data }, req.ip);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/students/:id ─────────────────────────────────────────────────
router.delete('/:id', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) throw new AppError(404, 'Student not found.', 'NOT_FOUND');

    // Soft delete
    await prisma.student.update({ where: { id: req.params.id }, data: { isActive: false } });
    await auditLog(req.user!.id, 'DELETE_STUDENT', 'Student', req.params.id, { name: student.fullName }, req.ip);
    res.json({ success: true, message: 'Student deleted.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/students/import ─────────────────────────────────────────────────
router.post('/import', authorize(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      rows: z.array(z.object({
        enrollmentNumber: z.string().min(1),
        fullName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        departmentId: z.string().cuid(),
        academicYearId: z.string().cuid(),
        admissionDate: z.coerce.date(),
      })).min(1).max(500),
    });
    const { rows } = schema.parse(req.body);

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const exists = await prisma.student.findUnique({
          where: { enrollmentNumber: row.enrollmentNumber },
        });
        if (exists) { results.skipped++; continue; }
        await prisma.student.create({ data: row });
        results.created++;
      } catch {
        results.errors.push(`Failed for enrollment: ${row.enrollmentNumber}`);
      }
    }

    await auditLog(req.user!.id, 'IMPORT_STUDENTS', 'Student', undefined, results, req.ip);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

export default router;
