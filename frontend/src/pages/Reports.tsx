import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, FileDown, Download, Loader2 } from 'lucide-react';
import { api } from '@/services/api';

type Semester = { id: string; number: number; label: string };
type Section  = { id: string; name: string };
type Student  = { id: string; fullName: string; enrollmentNumber: string };

export default function ReportsPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [sections,  setSections]  = useState<Section[]>([]);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [selSem,    setSelSem]    = useState('');
  const [selSec,    setSelSec]    = useState('');
  const [selStudent,setSelStudent]= useState('');
  const [genPdf,    setGenPdf]    = useState(false);

  useEffect(() => {
    Promise.all([api.get('/semesters'), api.get('/enrollments')]).then(([semRes, enrRes]) => {
      setSemesters(semRes.data.data);
      const secMap = new Map<string, Section>();
      for (const e of enrRes.data.data) {
        if (!secMap.has(e.section.id)) secMap.set(e.section.id, e.section);
      }
      setSections([...secMap.values()]);
    });
  }, []);

  useEffect(() => {
    if (!selSem) return;
    const params: any = { semesterId: selSem, limit: 500 };
    if (selSec) params.sectionId = selSec;
    api.get('/students', { params }).then((r) => setStudents(r.data.data));
  }, [selSem, selSec]);

  function handleStudentPdf() {
    if (!selStudent || !selSem) return;
    setGenPdf(true);
    window.open(`/api/reports/result-card/${selStudent}?semesterId=${selSem}`, '_blank');
    setTimeout(() => setGenPdf(false), 1500);
  }

  function handleClassCsv() {
    if (!selSem) return;
    window.open(`/api/reports/csv/results?semesterId=${selSem}${selSec ? `&sectionId=${selSec}` : ''}`, '_blank');
  }

  function handleStudentsCsv() {
    window.open('/api/reports/csv/students', '_blank');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Reports & Exports</h1>
        <p className="page-sub">Generate PDF result cards and export data as CSV.</p>
      </div>

      {/* PDF report card */}
      <div className="card-p space-y-4">
        <h2 className="text-base font-semibold">Student Result Card (PDF)</h2>
        <p className="text-sm text-ink-secondary">
          Generate a formatted A4 PDF result card for a single student.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="label">Semester</label>
            <div className="relative">
              <select value={selSem} onChange={(e) => { setSelSem(e.target.value); setSelStudent(''); }} className="input pr-8 appearance-none">
                <option value="">Select semester</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="label">Section (optional)</label>
            <div className="relative">
              <select value={selSec} onChange={(e) => setSelSec(e.target.value)} className="input pr-8 appearance-none">
                <option value="">All sections</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="label">Student</label>
            <div className="relative">
              <select value={selStudent} onChange={(e) => setSelStudent(e.target.value)} className="input pr-8 appearance-none" disabled={!selSem}>
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.enrollmentNumber})</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
            </div>
          </div>
        </div>

        <button
          onClick={handleStudentPdf}
          disabled={!selSem || !selStudent || genPdf}
          className="btn-primary btn-sm"
        >
          {genPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
          Download PDF Result Card
        </button>
      </div>

      {/* CSV exports */}
      <div className="card-p space-y-4">
        <h2 className="text-base font-semibold">CSV Exports</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 py-2 border-b border-surface-border">
            <div>
              <div className="text-sm font-medium">Class Results</div>
              <div className="text-xs text-ink-secondary">All student results for a semester including ranks, grades and SGPA.</div>
            </div>
            <button onClick={handleClassCsv} disabled={!selSem} className="btn btn-sm shrink-0">
              <Download size={12} /> Export
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-medium">Student Directory</div>
              <div className="text-xs text-ink-secondary">Full list of all registered students with contact details.</div>
            </div>
            <button onClick={handleStudentsCsv} className="btn btn-sm shrink-0">
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {!selSem && (
          <p className="text-xs text-ink-secondary">Select a semester above to enable class results export.</p>
        )}
      </div>
    </div>
  );
}
