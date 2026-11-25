import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';
import { evaluateStudent, GradeEntry } from '../services/gradingEngine';
import PDFDocument from 'pdfkit';

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

function sanitizeCsv(value: unknown): string {
  const str = String(value ?? '');
  // Prevent formula injection
  if (str.match(/^[=+\-@|]/)) return `'${str}`;
  return str;
}

function csvRow(cells: unknown[]): string {
  return cells.map((c) => `"${sanitizeCsv(c).replace(/"/g, '""')}"`).join(',');
}

// ── GET /api/reports/result-card/:studentId?semesterId= ───────────────────────
router.get('/result-card/:studentId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ semesterId: z.string().cuid() });
    const { semesterId } = schema.parse(req.query);
    const { studentId } = req.params;

    // Role guard
    if (req.user!.role === 'STUDENT') {
      const s = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } });
      if (s?.userId !== req.user!.id) throw new AppError(403, 'Access denied.', 'FORBIDDEN');
    }

    const [student, semester, subjects, marks, scale, enrollment] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        include: { department: true },
      }),
      prisma.semester.findUnique({ where: { id: semesterId } }),
      prisma.subject.findMany({ where: { semesterId, isActive: true } }),
      prisma.mark.findMany({ where: { studentId, semesterId } }),
      getScale(),
      prisma.enrollment.findFirst({
        where: { studentId, semesterId },
        include: { section: true },
      }),
    ]);

    if (!student) throw new AppError(404, 'Student not found.', 'NOT_FOUND');
    if (!semester) throw new AppError(404, 'Semester not found.', 'NOT_FOUND');

    const marksMap = new Map(marks.map((m) => [m.subjectId, m.obtained]));
    const result = evaluateStudent(studentId, subjects, marksMap, scale);

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="result-${student.enrollmentNumber}-sem${semester.number}.pdf"`
      );
      res.end(pdf);
    });

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#12355B');
    doc.fillColor('#ffffff')
      .fontSize(18).font('Helvetica-Bold')
      .text('Student Grade Evaluation Report', 50, 20, { align: 'left' });
    doc.fontSize(10).font('Helvetica')
      .text(`${student.department.name} · ${semester.label} · MITS Gwalior`, 50, 48);
    doc.rect(0, 80, doc.page.width, 4).fill('#F2B84B');

    // Student info
    doc.fillColor('#101828').fontSize(11).font('Helvetica').moveDown(2);
    const infoY = 110;
    const infoData: [string, string][] = [
      ['Student Name', student.fullName],
      ['Enrollment No.', student.enrollmentNumber],
      ['Department', student.department.code],
      ['Semester', semester.label],
      ['Section', enrollment?.section.name ?? '—'],
      ['Date Generated', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
    ];

    infoData.forEach(([label, value], i) => {
      const y = infoY + i * 20;
      doc.font('Helvetica-Bold').fillColor('#687386').fontSize(10).text(label + ':', 50, y);
      doc.font('Helvetica').fillColor('#101828').text(value, 200, y);
    });

    // Marks table
    doc.moveDown(1);
    const tableTop = infoY + infoData.length * 20 + 20;
    const cols = { subject: 50, code: 220, max: 290, obtained: 350, pct: 410, grade: 460, gp: 505, status: 540 };
    const headers = ['Subject', 'Code', 'Max', 'Obtained', '%', 'Grade', 'GP', 'Status'];
    const colKeys = Object.keys(cols) as (keyof typeof cols)[];

    // Table header
    doc.rect(50, tableTop - 5, 500, 20).fill('#12355B');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    colKeys.forEach((k, i) => doc.text(headers[i], cols[k], tableTop));

    // Table rows
    result.subjects.forEach((sub, idx) => {
      const rowY = tableTop + 20 + idx * 18;
      if (idx % 2 === 0) doc.rect(50, rowY - 4, 500, 18).fill('#F7F8FA');
      doc.fillColor('#101828').fontSize(9).font('Helvetica');
      doc.text(sub.subjectName.substring(0, 28), cols.subject, rowY, { width: 165 });
      doc.text(sub.subjectCode, cols.code, rowY);
      doc.text(String(sub.maxMarks), cols.max, rowY);
      doc.text(sub.obtained !== null ? String(sub.obtained) : '—', cols.obtained, rowY);
      doc.text(sub.percentage !== null ? sub.percentage.toFixed(1) : '—', cols.pct, rowY);
      doc.text(sub.grade ?? '—', cols.grade, rowY);
      doc.text(sub.gradePoint !== null ? String(sub.gradePoint) : '—', cols.gp, rowY);
      doc.fillColor(sub.status === 'FAIL' ? '#B42318' : sub.status === 'PASS' ? '#17803D' : '#9A5B00')
        .text(sub.status, cols.status, rowY);
    });

    const summaryY = tableTop + 20 + result.subjects.length * 18 + 20;
    doc.rect(50, summaryY, 500, 1).fill('#E5E8ED');

    // Summary
    doc.fillColor('#101828').fontSize(12).font('Helvetica-Bold').text('Result Summary', 50, summaryY + 15);
    const summData: [string, string][] = [
      ['Total Marks', `${result.totalObtained} / ${result.totalMax}`],
      ['Overall Percentage', result.overallPercentage !== null ? result.overallPercentage.toFixed(2) + '%' : '—'],
      ['SGPA', result.sgpa !== null ? result.sgpa.toFixed(2) + ' / 10' : '—'],
      ['Overall Grade', result.overallGrade ?? '—'],
      ['Result', result.status],
    ];
    summData.forEach(([label, value], i) => {
      const y = summaryY + 35 + i * 18;
      doc.font('Helvetica-Bold').fillColor('#687386').fontSize(10).text(label + ':', 50, y);
      const isPass = value === 'PASS';
      const isFail = value === 'FAIL';
      doc.font('Helvetica').fillColor(isFail ? '#B42318' : isPass ? '#17803D' : '#101828').text(value, 200, y);
    });

    // Grading scale
    const scaleY = summaryY + 35 + summData.length * 18 + 30;
    doc.rect(50, scaleY, 300, 1).fill('#E5E8ED');
    doc.fillColor('#101828').fontSize(10).font('Helvetica-Bold').text('Grading Scale', 50, scaleY + 10);
    scale.forEach((g, i) => {
      const y = scaleY + 25 + i * 15;
      doc.fontSize(9).font('Helvetica').fillColor('#687386')
        .text(`${g.grade}: ≥${g.minPercent}%  →  GP ${g.gradePoint}  (${g.remark})`, 50, y);
    });

    // Signatures
    const sigY = doc.page.height - 100;
    doc.rect(50, sigY, 500, 1).fill('#E5E8ED');
    doc.fontSize(10).fillColor('#687386').font('Helvetica')
      .text('Student Signature: ________________________', 50, sigY + 20)
      .text('Mentor Signature: ________________________', 310, sigY + 20)
      .text('Controller of Examinations: ________________________', 50, sigY + 50);

    doc.end();
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/csv/results?semesterId=&sectionId= ───────────────────────
router.get('/csv/results', authorize(Role.ADMIN, Role.TEACHER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      semesterId: z.string().cuid(),
      sectionId: z.string().cuid().optional(),
    });
    const { semesterId, sectionId } = schema.parse(req.query);

    const enrollmentsWhere: any = { semesterId };
    if (sectionId) enrollmentsWhere.sectionId = sectionId;

    const [enrollments, subjects, scale] = await Promise.all([
      prisma.enrollment.findMany({
        where: enrollmentsWhere,
        include: {
          student: { select: { id: true, fullName: true, enrollmentNumber: true } },
          section: true,
        },
      }),
      prisma.subject.findMany({ where: { semesterId, isActive: true } }),
      getScale(),
    ]);

    const studentIds = enrollments.map((e) => e.studentId);
    const marks = await prisma.mark.findMany({ where: { semesterId, studentId: { in: studentIds } } });
    const marksByStudent = new Map<string, Map<string, number>>();
    for (const m of marks) {
      if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
      marksByStudent.get(m.studentId)!.set(m.subjectId, m.obtained);
    }

    const header = [
      'Rank', 'Name', 'Enrollment', 'Section',
      ...subjects.map((s) => `${s.name} (${s.code})`),
      'Total Obtained', 'Total Max', 'Percentage', 'SGPA', 'Overall Grade', 'Status',
    ];

    const rows = enrollments.map((e) => {
      const mm = marksByStudent.get(e.studentId) ?? new Map();
      return { enrollment: e, result: evaluateStudent(e.studentId, subjects, mm, scale) };
    });

    rows.sort((a, b) => (b.result.sgpa ?? -1) - (a.result.sgpa ?? -1));

    let rank = 0;
    const csvRows = rows.map((r, i) => {
      const { result, enrollment } = r;
      if (result.status === 'PASS' || result.status === 'FAIL') rank = i + 1;
      return csvRow([
        result.status === 'PENDING' || result.status === 'INCOMPLETE' ? '' : rank,
        enrollment.student.fullName,
        enrollment.student.enrollmentNumber,
        enrollment.section.name,
        ...subjects.map((s) => {
          const sr = result.subjects.find((x) => x.subjectId === s.id);
          return sr?.obtained ?? '';
        }),
        result.totalObtained,
        result.totalMax,
        result.overallPercentage !== null ? result.overallPercentage.toFixed(2) : '',
        result.sgpa !== null ? result.sgpa.toFixed(2) : '',
        result.overallGrade ?? '',
        result.status,
      ]);
    });

    const csv = [csvRow(header), ...csvRows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="results-sem${semesterId}.csv"`);
    res.end(csv);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/csv/students ─────────────────────────────────────────────
router.get('/csv/students', authorize(Role.ADMIN), async (_req, res: Response, next: NextFunction) => {
  try {
    const students = await prisma.student.findMany({
      where: { isActive: true },
      include: { department: true, academicYear: true },
      orderBy: { fullName: 'asc' },
    });

    const header = ['Enrollment No.', 'Full Name', 'Email', 'Phone', 'Department', 'Academic Year', 'Admission Date'];
    const csvRows = students.map((s) =>
      csvRow([
        s.enrollmentNumber,
        s.fullName,
        s.email,
        s.phone ?? '',
        s.department.code,
        s.academicYear.label,
        s.admissionDate.toISOString().split('T')[0],
      ])
    );
    const csv = [csvRow(header), ...csvRows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    res.end(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
