import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { evaluateStudent, rankStudents, GradeEntry } from '../services/gradingEngine';

const router = Router();
router.use(authenticate);

async function getScale(): Promise<GradeEntry[]> {
  const scale = await prisma.gradingScale.findMany({ orderBy: { sortOrder: 'asc' } });
  return scale.map((s) => ({
    grade: s.grade,
    minPercent: s.minPercent,
    gradePoint: s.gradePoint,
    remark: s.remark,
  }));
}

// ── GET /api/results/student/:studentId?semesterId= ───────────────────────────
router.get('/student/:studentId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ semesterId: z.string().cuid() });
    const { semesterId } = schema.parse(req.query);
    const { studentId } = req.params;

    // Role guard: students can only see their own result
    if (req.user!.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { userId: true },
      });
      if (student?.userId !== req.user!.id) {
        throw new AppError(403, 'Access denied.', 'FORBIDDEN');
      }
    }

    const [student, subjects, marks, scale] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, fullName: true, enrollmentNumber: true, department: true },
      }),
      prisma.subject.findMany({ where: { semesterId, isActive: true } }),
      prisma.mark.findMany({ where: { studentId, semesterId } }),
      getScale(),
    ]);

    if (!student) throw new AppError(404, 'Student not found.', 'NOT_FOUND');

    const marksMap = new Map(marks.map((m) => [m.subjectId, m.obtained]));
    const result = evaluateStudent(studentId, subjects, marksMap, scale);

    res.json({ success: true, data: { student, result, scale } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/results/semester/:semesterId?sectionId= ──────────────────────────
router.get('/semester/:semesterId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ sectionId: z.string().cuid().optional() });
    const { sectionId } = schema.parse(req.query);
    const { semesterId } = req.params;

    const enrollmentsWhere: any = { semesterId };
    if (sectionId) enrollmentsWhere.sectionId = sectionId;

    const [enrollments, subjects, allMarks, scale] = await Promise.all([
      prisma.enrollment.findMany({
        where: enrollmentsWhere,
        include: {
          student: { select: { id: true, fullName: true, enrollmentNumber: true, department: { select: { code: true } } } },
          section: true,
        },
      }),
      prisma.subject.findMany({ where: { semesterId, isActive: true } }),
      prisma.mark.findMany({
        where: { semesterId, studentId: { in: undefined } },
      }),
      getScale(),
    ]);

    const studentIds = enrollments.map((e) => e.studentId);
    const marks = await prisma.mark.findMany({
      where: { semesterId, studentId: { in: studentIds } },
    });

    const marksByStudent = new Map<string, Map<string, number>>();
    for (const m of marks) {
      if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
      marksByStudent.get(m.studentId)!.set(m.subjectId, m.obtained);
    }

    const results = enrollments.map((e) => {
      const marksMap = marksByStudent.get(e.studentId) ?? new Map();
      const result = evaluateStudent(e.studentId, subjects, marksMap, scale);
      return { student: e.student, section: e.section, result };
    });

    const ranked = rankStudents(results.map((r) => r.result));
    const rankedMap = new Map(ranked.map((r) => [r.studentId, r.rank]));

    const response = results.map((r) => ({
      ...r,
      rank: rankedMap.get(r.student.id) ?? null,
    }));

    res.json({ success: true, data: { subjects, results: response, scale } });
  } catch (err) {
    next(err);
  }
});

export default router;
