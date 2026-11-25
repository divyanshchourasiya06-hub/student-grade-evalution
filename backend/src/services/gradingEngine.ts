/**
 * Grading Engine — centralized, pure, testable calculation module.
 * All grade/SGPA calculations in the app MUST go through this module.
 */

export interface GradeEntry {
  grade: string;
  minPercent: number;
  gradePoint: number;
  remark: string;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  credits: number;
  obtained: number | null; // null = not entered yet
  percentage: number | null;
  grade: string | null;
  gradePoint: number | null;
  status: 'PASS' | 'FAIL' | 'PENDING';
}

export interface StudentResult {
  studentId: string;
  subjects: SubjectResult[];
  totalObtained: number;
  totalMax: number;
  overallPercentage: number | null;
  sgpa: number | null;
  overallGrade: string | null;
  status: 'PENDING' | 'INCOMPLETE' | 'PASS' | 'FAIL';
  failedSubjects: number;
  completedSubjects: number;
  totalSubjects: number;
}

/** Look up the matching grade entry for a given percentage, sorted descending. */
export function getGrade(
  percentage: number,
  scale: GradeEntry[]
): GradeEntry {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  for (const entry of sorted) {
    if (percentage >= entry.minPercent) return entry;
  }
  // Fall back to lowest (F)
  return sorted[sorted.length - 1];
}

/** Calculate subject-level result. */
export function calcSubjectResult(
  subjectId: string,
  subjectName: string,
  subjectCode: string,
  maxMarks: number,
  credits: number,
  obtained: number | null,
  scale: GradeEntry[]
): SubjectResult {
  if (obtained === null) {
    return {
      subjectId,
      subjectName,
      subjectCode,
      maxMarks,
      credits,
      obtained: null,
      percentage: null,
      grade: null,
      gradePoint: null,
      status: 'PENDING',
    };
  }

  const percentage = (obtained / maxMarks) * 100;
  const gradeEntry = getGrade(percentage, scale);

  return {
    subjectId,
    subjectName,
    subjectCode,
    maxMarks,
    credits,
    obtained,
    percentage,
    grade: gradeEntry.grade,
    gradePoint: gradeEntry.gradePoint,
    status: gradeEntry.gradePoint === 0 ? 'FAIL' : 'PASS',
  };
}

/** Calculate full student result from an array of subject results. */
export function calcStudentResult(
  studentId: string,
  subjects: SubjectResult[]
): StudentResult {
  const total = subjects.length;
  const completed = subjects.filter((s) => s.obtained !== null);
  const failedSubjects = completed.filter((s) => s.status === 'FAIL').length;

  const totalObtained = completed.reduce((acc, s) => acc + (s.obtained ?? 0), 0);
  const totalMax = completed.reduce((acc, s) => acc + s.maxMarks, 0);
  const allMax = subjects.reduce((acc, s) => acc + s.maxMarks, 0);

  if (completed.length === 0) {
    return {
      studentId,
      subjects,
      totalObtained: 0,
      totalMax: allMax,
      overallPercentage: null,
      sgpa: null,
      overallGrade: null,
      status: 'PENDING',
      failedSubjects: 0,
      completedSubjects: 0,
      totalSubjects: total,
    };
  }

  if (completed.length < total) {
    // Partial — do not compute SGPA
    return {
      studentId,
      subjects,
      totalObtained,
      totalMax,
      overallPercentage: totalMax ? (totalObtained / totalMax) * 100 : null,
      sgpa: null,
      overallGrade: null,
      status: 'INCOMPLETE',
      failedSubjects,
      completedSubjects: completed.length,
      totalSubjects: total,
    };
  }

  // All subjects marked
  const weightedGP = subjects.reduce(
    (acc, s) => acc + (s.gradePoint ?? 0) * s.credits,
    0
  );
  const totalCredits = subjects.reduce((acc, s) => acc + s.credits, 0);
  const sgpa = totalCredits ? weightedGP / totalCredits : 0;
  const overallPercentage = (totalObtained / totalMax) * 100;

  return {
    studentId,
    subjects,
    totalObtained,
    totalMax,
    overallPercentage,
    sgpa,
    overallGrade: completed[0]?.grade ?? null, // Recomputed below
    status: failedSubjects > 0 ? 'FAIL' : 'PASS',
    failedSubjects,
    completedSubjects: total,
    totalSubjects: total,
  };
}

/** Full pipeline: marks + subjects + scale → StudentResult */
export function evaluateStudent(
  studentId: string,
  subjectDefs: { id: string; name: string; code: string; maxMarks: number; credits: number }[],
  marksMap: Map<string, number>, // subjectId → obtained marks
  scale: GradeEntry[]
): StudentResult {
  const subjectResults = subjectDefs.map((sub) => {
    const obtained = marksMap.has(sub.id) ? marksMap.get(sub.id)! : null;
    return calcSubjectResult(
      sub.id,
      sub.name,
      sub.code,
      sub.maxMarks,
      sub.credits,
      obtained,
      scale
    );
  });

  const result = calcStudentResult(studentId, subjectResults);

  // Compute overallGrade from final percentage
  if (result.overallPercentage !== null && result.status !== 'PENDING' && result.status !== 'INCOMPLETE') {
    const gradeEntry = getGrade(result.overallPercentage, scale);
    result.overallGrade = gradeEntry.grade;
  }

  return result;
}

/** Rank a list of student results (SGPA desc, then percentage desc). */
export function rankStudents(results: StudentResult[]): (StudentResult & { rank: number })[] {
  const eligible = results
    .filter((r) => r.status === 'PASS' || r.status === 'FAIL')
    .sort((a, b) => {
      if ((b.sgpa ?? 0) !== (a.sgpa ?? 0)) return (b.sgpa ?? 0) - (a.sgpa ?? 0);
      return (b.overallPercentage ?? 0) - (a.overallPercentage ?? 0);
    });

  let rank = 1;
  return eligible.map((r, i) => {
    if (i > 0) {
      const prev = eligible[i - 1];
      if (r.sgpa !== prev.sgpa || r.overallPercentage !== prev.overallPercentage) {
        rank = i + 1;
      }
    }
    return { ...r, rank };
  });
}

/** Grade distribution across a list of results. */
export function gradeDistribution(
  results: StudentResult[],
  scale: GradeEntry[]
): { grade: string; count: number; percentage: number }[] {
  const eligible = results.filter(
    (r) => r.status === 'PASS' || r.status === 'FAIL'
  );
  const total = eligible.length;
  const countMap = new Map<string, number>();
  for (const r of eligible) {
    if (r.overallGrade) {
      countMap.set(r.overallGrade, (countMap.get(r.overallGrade) ?? 0) + 1);
    }
  }
  return scale.map((g) => ({
    grade: g.grade,
    count: countMap.get(g.grade) ?? 0,
    percentage: total ? ((countMap.get(g.grade) ?? 0) / total) * 100 : 0,
  }));
}

export const DEFAULT_GRADING_SCALE: GradeEntry[] = [
  { grade: 'A+', minPercent: 90, gradePoint: 10, remark: 'Outstanding' },
  { grade: 'A',  minPercent: 80, gradePoint: 9,  remark: 'Excellent' },
  { grade: 'B+', minPercent: 70, gradePoint: 8,  remark: 'Very Good' },
  { grade: 'B',  minPercent: 60, gradePoint: 7,  remark: 'Good' },
  { grade: 'C+', minPercent: 50, gradePoint: 6,  remark: 'Above Average' },
  { grade: 'C',  minPercent: 45, gradePoint: 5,  remark: 'Average' },
  { grade: 'D',  minPercent: 40, gradePoint: 4,  remark: 'Pass' },
  { grade: 'F',  minPercent: 0,  gradePoint: 0,  remark: 'Fail' },
];
