/**
 * Database seed — creates default data for development & demonstration.
 * Run: npm run db:seed
 */
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';
import { DEFAULT_GRADING_SCALE } from './services/gradingEngine';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Grading scale ──────────────────────────────────────────────────────────
  await prisma.gradingScale.deleteMany();
  const sortedScale = [...DEFAULT_GRADING_SCALE]
    .sort((a, b) => b.minPercent - a.minPercent)
    .map((e, i) => ({ ...e, sortOrder: i, isDefault: true }));
  await prisma.gradingScale.createMany({ data: sortedScale });
  console.log('✅ Grading scale seeded.');

  // ── Department ─────────────────────────────────────────────────────────────
  const dept = await prisma.department.upsert({
    where: { code: 'CSBS' },
    update: {},
    create: { name: 'Computer Science & Business Systems', code: 'CSBS' },
  });
  console.log('✅ Department seeded:', dept.code);

  // ── Academic Year ──────────────────────────────────────────────────────────
  const year = await prisma.academicYear.upsert({
    where: { label: '2024-25' },
    update: { isCurrent: true },
    create: { label: '2024-25', startYear: 2024, endYear: 2025, isCurrent: true },
  });
  console.log('✅ Academic year seeded:', year.label);

  // ── Semesters ──────────────────────────────────────────────────────────────
  const semesterDefs = [
    { number: 1, label: 'Semester I' },
    { number: 2, label: 'Semester II' },
    { number: 3, label: 'Semester III' },
    { number: 4, label: 'Semester IV' },
    { number: 5, label: 'Semester V' },
    { number: 6, label: 'Semester VI' },
    { number: 7, label: 'Semester VII' },
    { number: 8, label: 'Semester VIII' },
  ];
  for (const s of semesterDefs) {
    await prisma.semester.upsert({ where: { number: s.number }, update: {}, create: s });
  }
  const sem1 = await prisma.semester.findUnique({ where: { number: 1 } });
  console.log('✅ Semesters seeded.');

  // ── Section ────────────────────────────────────────────────────────────────
  const section = await prisma.section.upsert({
    where: { name: 'CSBS-A' },
    update: {},
    create: { name: 'CSBS-A' },
  });
  console.log('✅ Section seeded:', section.name);

  // ── Subjects (Sem I CSBS — typical papers) ────────────────────────────────
  const subjectDefs = [
    { name: 'Digital Logic Design', code: 'CS101', maxMarks: 100, credits: 4 },
    { name: 'Engineering Mathematics I', code: 'MA101', maxMarks: 100, credits: 4 },
    { name: 'Programming in C', code: 'CS102', maxMarks: 100, credits: 3 },
    { name: 'Engineering Physics', code: 'PH101', maxMarks: 100, credits: 3 },
    { name: 'Communication Skills', code: 'HS101', maxMarks: 100, credits: 2 },
    { name: 'C Lab', code: 'CS102L', maxMarks: 50, credits: 2, type: 'PRACTICAL' as const },
  ];
  for (const sub of subjectDefs) {
    await prisma.subject.upsert({
      where: { code: sub.code },
      update: {},
      create: {
        ...sub,
        type: sub.type ?? 'THEORY',
        semesterId: sem1!.id,
        departmentId: dept.id,
      },
    });
  }
  const subjects = await prisma.subject.findMany({ where: { semesterId: sem1!.id } });
  console.log('✅ Subjects seeded:', subjects.length);

  // ── Admin user ─────────────────────────────────────────────────────────────
  const adminPwd = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345';
  const adminHash = await argon2.hash(adminPwd);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mits.ac.in' },
    update: {},
    create: { email: 'admin@mits.ac.in', passwordHash: adminHash, role: Role.ADMIN },
  });
  console.log('✅ Admin user seeded: admin@mits.ac.in (password from ADMIN_DEFAULT_PASSWORD env)');

  // ── Sample students ────────────────────────────────────────────────────────
  const sampleStudents = [
    { name: 'Aarav Sharma', enr: '0901CS261001', email: 'aarav.sharma@student.mits.ac.in' },
    { name: 'Diya Verma', enr: '0901CS261002', email: 'diya.verma@student.mits.ac.in' },
    { name: 'Kabir Singh', enr: '0901CS261003', email: 'kabir.singh@student.mits.ac.in' },
    { name: 'Meera Joshi', enr: '0901CS261004', email: 'meera.joshi@student.mits.ac.in' },
    { name: 'Rohan Gupta', enr: '0901CS261005', email: 'rohan.gupta@student.mits.ac.in' },
  ];

  const sampleMarks: Record<string, number[]> = {
    '0901CS261001': [88, 92, 85, 90, 78, 44], // Aarav
    '0901CS261002': [76, 81, 69, 74, 72, 38], // Diya
    '0901CS261003': [58, 47, 62, 51, 55, 25], // Kabir
    '0901CS261004': [95, 91, 97, 93, 89, 50], // Meera
    '0901CS261005': [38, 52, 44, 60, 48, 20], // Rohan
  };

  for (const ss of sampleStudents) {
    const existing = await prisma.student.findUnique({ where: { enrollmentNumber: ss.enr } });
    let student = existing;
    if (!student) {
      student = await prisma.student.create({
        data: {
          enrollmentNumber: ss.enr,
          fullName: ss.name,
          email: ss.email,
          departmentId: dept.id,
          academicYearId: year.id,
          admissionDate: new Date('2024-08-01'),
        },
      });
    }

    // Enroll
    await prisma.enrollment.upsert({
      where: { studentId_semesterId: { studentId: student.id, semesterId: sem1!.id } },
      update: {},
      create: { studentId: student.id, semesterId: sem1!.id, sectionId: section.id },
    });

    // Marks
    const marks = sampleMarks[ss.enr];
    for (let i = 0; i < subjects.length; i++) {
      await prisma.mark.upsert({
        where: {
          studentId_subjectId_semesterId: {
            studentId: student.id,
            subjectId: subjects[i].id,
            semesterId: sem1!.id,
          },
        },
        update: { obtained: marks[i] },
        create: {
          studentId: student.id,
          subjectId: subjects[i].id,
          semesterId: sem1!.id,
          obtained: marks[i],
          enteredBy: adminUser.id,
        },
      });
    }
  }
  console.log('✅ Sample students and marks seeded.');
  console.log('\n🎉 Seed complete!');
  console.log('   Admin login: admin@mits.ac.in / (see ADMIN_DEFAULT_PASSWORD in .env)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
