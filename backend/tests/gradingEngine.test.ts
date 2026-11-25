import { describe, it, expect } from 'vitest';
import {
  getGrade,
  calcSubjectResult,
  calcStudentResult,
  evaluateStudent,
  rankStudents,
  gradeDistribution,
  DEFAULT_GRADING_SCALE,
} from '../src/services/gradingEngine';

const scale = DEFAULT_GRADING_SCALE;

describe('getGrade', () => {
  it('returns A+ for 90%', () => expect(getGrade(90, scale).grade).toBe('A+'));
  it('returns A+ for 100%', () => expect(getGrade(100, scale).grade).toBe('A+'));
  it('returns A for 80%', () => expect(getGrade(80, scale).grade).toBe('A'));
  it('returns A for 89.99%', () => expect(getGrade(89.99, scale).grade).toBe('A'));
  it('returns B+ for 70%', () => expect(getGrade(70, scale).grade).toBe('B+'));
  it('returns B for 60%', () => expect(getGrade(60, scale).grade).toBe('B'));
  it('returns C+ for 50%', () => expect(getGrade(50, scale).grade).toBe('C+'));
  it('returns C for 45%', () => expect(getGrade(45, scale).grade).toBe('C'));
  it('returns D for 40%', () => expect(getGrade(40, scale).grade).toBe('D'));
  it('returns D for 44.99%', () => expect(getGrade(44.99, scale).grade).toBe('D'));
  it('returns F for 39.99%', () => expect(getGrade(39.99, scale).grade).toBe('F'));
  it('returns F for 0%', () => expect(getGrade(0, scale).grade).toBe('F'));
  it('returns F gradePoint 0', () => expect(getGrade(0, scale).gradePoint).toBe(0));
  it('returns D gradePoint 4', () => expect(getGrade(40, scale).gradePoint).toBe(4));
  it('returns A+ gradePoint 10', () => expect(getGrade(90, scale).gradePoint).toBe(10));
});

describe('calcSubjectResult', () => {
  it('handles null obtained (pending)', () => {
    const r = calcSubjectResult('s1', 'Math', 'MA101', 100, 4, null, scale);
    expect(r.status).toBe('PENDING');
    expect(r.grade).toBeNull();
    expect(r.percentage).toBeNull();
  });

  it('calculates percentage correctly', () => {
    const r = calcSubjectResult('s1', 'Math', 'MA101', 100, 4, 85, scale);
    expect(r.percentage).toBeCloseTo(85);
  });

  it('marks zero as FAIL', () => {
    const r = calcSubjectResult('s1', 'Math', 'MA101', 100, 4, 0, scale);
    expect(r.status).toBe('FAIL');
    expect(r.gradePoint).toBe(0);
  });

  it('marks exactly 40 as PASS (D)', () => {
    const r = calcSubjectResult('s1', 'Math', 'MA101', 100, 4, 40, scale);
    expect(r.status).toBe('PASS');
    expect(r.grade).toBe('D');
  });

  it('marks 39 as FAIL', () => {
    const r = calcSubjectResult('s1', 'Math', 'MA101', 100, 4, 39, scale);
    expect(r.status).toBe('FAIL');
  });

  it('handles non-100 max correctly', () => {
    const r = calcSubjectResult('s1', 'Lab', 'CS101L', 50, 2, 45, scale);
    expect(r.percentage).toBeCloseTo(90);
    expect(r.grade).toBe('A+');
  });
});

describe('evaluateStudent — full pipeline', () => {
  const subjects = [
    { id: 's1', name: 'Math', code: 'MA', maxMarks: 100, credits: 4 },
    { id: 's2', name: 'Physics', code: 'PH', maxMarks: 100, credits: 3 },
    { id: 's3', name: 'Programming', code: 'CS', maxMarks: 100, credits: 3 },
  ];

  it('returns PENDING when no marks entered', () => {
    const r = evaluateStudent('st1', subjects, new Map(), scale);
    expect(r.status).toBe('PENDING');
    expect(r.sgpa).toBeNull();
  });

  it('returns INCOMPLETE when only some marks entered', () => {
    const mm = new Map([['s1', 80]]);
    const r = evaluateStudent('st1', subjects, mm, scale);
    expect(r.status).toBe('INCOMPLETE');
    expect(r.sgpa).toBeNull();
  });

  it('calculates SGPA correctly with all marks', () => {
    // s1: 80% → A(9) × 4 = 36; s2: 70% → B+(8) × 3 = 24; s3: 60% → B(7) × 3 = 21 → total=81, cred=10 → 8.1
    const mm = new Map([['s1', 80], ['s2', 70], ['s3', 60]]);
    const r = evaluateStudent('st1', subjects, mm, scale);
    expect(r.status).toBe('PASS');
    expect(r.sgpa).toBeCloseTo(8.1);
  });

  it('marks FAIL when any subject fails', () => {
    const mm = new Map([['s1', 80], ['s2', 70], ['s3', 35]]); // s3 = F
    const r = evaluateStudent('st1', subjects, mm, scale);
    expect(r.status).toBe('FAIL');
    expect(r.failedSubjects).toBe(1);
  });

  it('calculates overall percentage correctly', () => {
    const mm = new Map([['s1', 50], ['s2', 50], ['s3', 50]]);
    const r = evaluateStudent('st1', subjects, mm, scale);
    expect(r.overallPercentage).toBeCloseTo(50);
  });

  it('handles maximum marks', () => {
    const mm = new Map([['s1', 100], ['s2', 100], ['s3', 100]]);
    const r = evaluateStudent('st1', subjects, mm, scale);
    expect(r.overallPercentage).toBe(100);
    expect(r.sgpa).toBe(10);
    expect(r.overallGrade).toBe('A+');
  });

  it('handles all zeros', () => {
    const mm = new Map([['s1', 0], ['s2', 0], ['s3', 0]]);
    const r = evaluateStudent('st1', subjects, mm, scale);
    expect(r.status).toBe('FAIL');
    expect(r.overallPercentage).toBe(0);
    expect(r.sgpa).toBe(0);
  });
});

describe('rankStudents', () => {
  it('ranks by SGPA descending', () => {
    const subjects = [{ id: 's1', name: 'Math', code: 'MA', maxMarks: 100, credits: 4 }];
    const r1 = evaluateStudent('st1', subjects, new Map([['s1', 90]]), scale);
    const r2 = evaluateStudent('st2', subjects, new Map([['s1', 70]]), scale);
    const ranked = rankStudents([r2, r1]);
    expect(ranked[0].studentId).toBe('st1');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('assigns same rank on tie', () => {
    const subjects = [{ id: 's1', name: 'Math', code: 'MA', maxMarks: 100, credits: 4 }];
    const r1 = evaluateStudent('st1', subjects, new Map([['s1', 80]]), scale);
    const r2 = evaluateStudent('st2', subjects, new Map([['s1', 80]]), scale);
    const ranked = rankStudents([r1, r2]);
    expect(ranked[0].rank).toBe(ranked[1].rank);
  });

  it('excludes PENDING students from ranking', () => {
    const subjects = [{ id: 's1', name: 'Math', code: 'MA', maxMarks: 100, credits: 4 }];
    const r1 = evaluateStudent('st1', subjects, new Map([['s1', 90]]), scale);
    const r2 = evaluateStudent('st2', subjects, new Map(), scale); // PENDING
    const ranked = rankStudents([r1, r2]);
    expect(ranked.length).toBe(1);
    expect(ranked[0].studentId).toBe('st1');
  });
});

describe('gradeDistribution', () => {
  it('counts correctly', () => {
    const subjects = [{ id: 's1', name: 'Math', code: 'MA', maxMarks: 100, credits: 4 }];
    const r1 = evaluateStudent('st1', subjects, new Map([['s1', 95]]), scale); // A+
    const r2 = evaluateStudent('st2', subjects, new Map([['s1', 85]]), scale); // A
    const r3 = evaluateStudent('st3', subjects, new Map([['s1', 95]]), scale); // A+
    const dist = gradeDistribution([r1, r2, r3], scale);
    const aPlusDist = dist.find((d) => d.grade === 'A+');
    const aDist = dist.find((d) => d.grade === 'A');
    expect(aPlusDist?.count).toBe(2);
    expect(aDist?.count).toBe(1);
  });
});
