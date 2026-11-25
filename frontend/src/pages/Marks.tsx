import { useEffect, useState, useCallback, useRef } from 'react';
import { Save, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { api } from '@/services/api';
import { fmtPct } from '@/utils/helpers';

type Semester = { id: string; number: number; label: string };
type Section  = { id: string; name: string };
type Subject  = { id: string; name: string; code: string; maxMarks: number; credits: number };
type Student  = { id: string; fullName: string; enrollmentNumber: string };
type MarkCell = { obtained: number; markId: string } | null;

export default function MarksPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [sections,  setSections]  = useState<Section[]>([]);
  const [selSem,    setSelSem]    = useState('');
  const [selSec,    setSelSec]    = useState('');
  const [subjects,  setSubjects]  = useState<Subject[]>([]);
  const [rows,      setRows]      = useState<{ student: Student; marks: Record<string, MarkCell> }[]>([]);
  const [drafts,    setDrafts]    = useState<Record<string, Record<string, string>>>({});
  const [errors,    setErrors]    = useState<Record<string, Record<string, string>>>({});
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [pageErr,   setPageErr]   = useState('');
  const [saved,     setSaved]     = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load semesters & sections
  useEffect(() => {
    Promise.all([api.get('/semesters'), api.get('/enrollments')]).then(([semRes, enrRes]) => {
      setSemesters(semRes.data.data);
      // Collect unique sections from enrollments
      const secMap = new Map<string, Section>();
      for (const e of enrRes.data.data) {
        if (!secMap.has(e.section.id)) secMap.set(e.section.id, e.section);
      }
      setSections([...secMap.values()]);
    });
  }, []);

  const loadSheet = useCallback(async () => {
    if (!selSem || !selSec) return;
    setLoading(true);
    setPageErr('');
    try {
      const r = await api.get('/marks/sheet', { params: { semesterId: selSem, sectionId: selSec } });
      setSubjects(r.data.data.subjects);
      setRows(r.data.data.rows);
      // Initialise drafts from existing marks
      const d: typeof drafts = {};
      for (const row of r.data.data.rows) {
        d[row.student.id] = {};
        for (const sub of r.data.data.subjects) {
          const cell = row.marks[sub.id];
          d[row.student.id][sub.id] = cell !== null ? String(cell.obtained) : '';
        }
      }
      setDrafts(d);
      setErrors({});
    } catch {
      setPageErr('Failed to load marks sheet.');
    } finally {
      setLoading(false);
    }
  }, [selSem, selSec]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  function handleChange(studentId: string, subjectId: string, value: string) {
    setDrafts((d) => ({
      ...d,
      [studentId]: { ...(d[studentId] ?? {}), [subjectId]: value },
    }));
    // Validate
    const sub = subjects.find((s) => s.id === subjectId);
    if (sub && value !== '') {
      const n = Number(value);
      if (isNaN(n) || n < 0 || n > sub.maxMarks) {
        setErrors((e) => ({
          ...e,
          [studentId]: { ...(e[studentId] ?? {}), [subjectId]: `0–${sub.maxMarks}` },
        }));
      } else {
        setErrors((e) => {
          const copy = { ...e };
          delete copy[studentId]?.[subjectId];
          return copy;
        });
      }
    } else {
      setErrors((e) => {
        const copy = { ...e };
        delete copy[studentId]?.[subjectId];
        return copy;
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const entries: { studentId: string; subjectId: string; obtained: number }[] = [];
    for (const [studentId, subMap] of Object.entries(drafts)) {
      for (const [subjectId, val] of Object.entries(subMap)) {
        if (val === '' || val === undefined) continue;
        const n = Number(val);
        if (!isNaN(n) && n >= 0) {
          entries.push({ studentId, subjectId, obtained: n });
        }
      }
    }
    if (entries.length === 0) { setSaving(false); return; }
    try {
      await api.put('/marks/bulk', { semesterId: selSem, entries });
      setSaved(true);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaved(false), 3000);
      loadSheet();
    } catch (e: any) {
      setPageErr(e.response?.data?.error ?? 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  }

  function getGradeLabel(val: string, maxMarks: number): string {
    if (val === '' || isNaN(Number(val))) return '';
    const pct = (Number(val) / maxMarks) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C+';
    if (pct >= 45) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  const hasErrors = Object.values(errors).some((e) => Object.keys(e ?? {}).length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Marks Entry</h1>
        <p className="page-sub">Select a semester and section to enter marks.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="label">Semester</label>
          <div className="relative">
            <select
              value={selSem}
              onChange={(e) => { setSelSem(e.target.value); setRows([]); }}
              className="input pr-8 appearance-none"
            >
              <option value="">Select semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="label">Section</label>
          <div className="relative">
            <select
              value={selSec}
              onChange={(e) => { setSelSec(e.target.value); setRows([]); }}
              className="input pr-8 appearance-none"
            >
              <option value="">Select section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
          </div>
        </div>
      </div>

      {pageErr && (
        <div className="flex items-center gap-2 text-sm text-bad bg-bad-light border border-bad/20 rounded px-3 py-2">
          <AlertCircle size={14} /> {pageErr}
        </div>
      )}

      {selSem && selSec && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-ink-secondary">{rows.length} student(s) · {subjects.length} subject(s)</p>
            <div className="flex items-center gap-2">
              {saved && <span className="text-sm text-ok font-medium">Marks saved ✓</span>}
              <button
                onClick={handleSave}
                disabled={saving || hasErrors}
                className="btn-primary btn-sm"
              >
                {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save all marks</>}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-ink-secondary gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading marks sheet…
            </div>
          ) : rows.length === 0 ? (
            <div className="card-p text-sm text-ink-secondary text-center py-8">
              No students enrolled in this semester and section.
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-surface-bg z-10 min-w-[160px]">Student</th>
                    {subjects.map((s) => (
                      <th key={s.id} className="text-center min-w-[90px]">
                        <div>{s.code}</div>
                        <div className="text-2xs text-ink-secondary/70 font-normal">/{s.maxMarks}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ student }) => (
                    <tr key={student.id}>
                      <td className="sticky left-0 bg-white z-10 border-r border-surface-border">
                        <div className="font-medium text-xs">{student.fullName}</div>
                        <div className="text-2xs text-ink-secondary">{student.enrollmentNumber}</div>
                      </td>
                      {subjects.map((sub) => {
                        const val = drafts[student.id]?.[sub.id] ?? '';
                        const err = errors[student.id]?.[sub.id];
                        const grade = val !== '' && !err ? getGradeLabel(val, sub.maxMarks) : '';
                        return (
                          <td key={sub.id} className="p-1 text-center">
                            <input
                              type="number"
                              min={0}
                              max={sub.maxMarks}
                              value={val}
                              onChange={(e) => handleChange(student.id, sub.id, e.target.value)}
                              className={`w-16 text-center rounded border px-1 py-1 text-xs focus:outline-none focus:border-blue-400 ${
                                err ? 'border-bad bg-bad-light text-bad' : 'border-surface-border'
                              }`}
                              placeholder="—"
                            />
                            {grade && !err && (
                              <div className={`text-2xs font-semibold mt-0.5 ${grade === 'F' ? 'text-bad' : 'text-ok'}`}>
                                {grade}
                              </div>
                            )}
                            {err && <div className="text-2xs text-bad mt-0.5">{err}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
