import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { evaluateStudent, gradeDistribution, GradeEntry } from '../services/gradingEngine';

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

// ── GET /api/analytics/dashboard ─────────────────────────────────────────────
router.get('/dashboard', async (_req, res: Response, next: NextFunction) => {
  try {
    const [
      totalStudents,
      totalSubjects,
      semesters,
      gradingScales,
    ] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.subject.count({ where: { isActive: true } }),
      prisma.semester.findMany({ orderBy: { number: 'asc' } }),
      getScale(),
    ]);

    // Get all marks for all active students across the most recent semester
    const latestSemester = semesters[semesters.length - 1];
    let classStats = null;

    if (latestSemester) {
      const [enrollments, subjects, marks] = await Promise.all([
        prisma.enrollment.findMany({
          where: { semesterId: latestSemester.id },
          select: { studentId: true },
        }),
        prisma.subject.findMany({ where: { semesterId: latestSemester.id, isActive: true } }),
        prisma.mark.findMany({ where: { semesterId: latestSemester.id } }),
      ]);

      const studentIds = enrollments.map((e) => e.studentId);
      const marksByStudent = new Map<string, Map<string, number>>();
      for (const m of marks) {
        if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
        marksByStudent.get(m.studentId)!.set(m.subjectId, m.obtained);
      }

      const results = studentIds.map((sid) => {
        const mm = marksByStudent.get(sid) ?? new Map();
        return evaluateStudent(sid, subjects, mm, gradingScales);
      });

      const completed = results.filter((r) => r.status === 'PASS' || r.status === 'FAIL');
      const passed = completed.filter((r) => r.status === 'PASS');
      const avgPct = completed.length
        ? completed.reduce((a, r) => a + (r.overallPercentage ?? 0), 0) / completed.length
        : null;
      const topStudent = completed.sort((a, b) => (b.sgpa ?? 0) - (a.sgpa ?? 0))[0];
      const topStudentInfo = topStudent
        ? await prisma.student.findUnique({
            where: { id: topStudent.studentId },
            select: { fullName: true, enrollmentNumber: true },
          })
        : null;

      const dist = gradeDistribution(results, gradingScales);

      classStats = {
        semesterLabel: latestSemester.label,
        evaluated: completed.length,
        pending: studentIds.length - completed.length,
        passCount: passed.length,
        failCount: completed.length - passed.length,
        passPercent: completed.length ? (passed.length / completed.length) * 100 : null,
        classAvgPercent: avgPct,
        highestSgpa: topStudent?.sgpa ?? null,
        topper: topStudentInfo,
        gradeDistribution: dist,
      };
    }

    // Recent activity
    const recentStudents = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { fullName: true, enrollmentNumber: true, createdAt: true },
    });

    const recentMarks = await prisma.mark.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        student: { select: { fullName: true } },
        subject: { select: { name: true } },
      },
    });

    res.json({
      success: true,
      data: {
        totalStudents,
        totalSubjects,
        classStats,
        recentStudents,
        recentMarks: recentMarks.map((m) => ({
          student: m.student.fullName,
          subject: m.subject.name,
          obtained: m.obtained,
          updatedAt: m.updatedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/subjects?semesterId= ──────────────────────────────────
router.get('/subjects', async (req, res: Response, next: NextFunction) => {
  try {
    const { semesterId } = z.object({ semesterId: z.string().cuid() }).parse(req.query);

    const subjects = await prisma.subject.findMany({
      where: { semesterId, isActive: true },
    });

    const subjectStats = await Promise.all(
      subjects.map(async (sub) => {
        const marks = await prisma.mark.findMany({
          where: { subjectId: sub.id, semesterId },
          select: { obtained: true },
        });
        const vals = marks.map((m) => m.obtained);
        const avg = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
        const max = vals.length ? Math.max(...vals) : null;
        const min = vals.length ? Math.min(...vals) : null;
        const passCount = vals.filter((v) => (v / sub.maxMarks) * 100 >= 40).length;
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          maxMarks: sub.maxMarks,
          credits: sub.credits,
          entryCount: vals.length,
          average: avg,
          highest: max,
          lowest: min,
          passPercent: vals.length ? (passCount / vals.length) * 100 : null,
        };
      })
    );

    res.json({ success: true, data: subjectStats });
  } catch (err) {
    next(err);
  }
});

export default router;
