import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Download, Loader2, AlertCircle, FileDown } from 'lucide-react';
import { api } from '@/services/api';
import { fmtPct, fmt2, statusClass, statusLabel } from '@/utils/helpers';

type Semester = { id: string; number: number; label: string };
type Section  = { id: string; name: string };

export default function ResultsPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [sections,  setSections]  = useState<Section[]>([]);
  const [selSem,    setSelSem]    = useState('');
  const [selSec,    setSelSec]    = useState('');
  const [results,   setResults]   = useState<any[]>([]);
  const [subjects,  setSubjects]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [genPdf,    setGenPdf]    = useState<string | null>(null);

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

  const load = useCallback(async () => {
    if (!selSem) return;
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/results/semester/${selSem}`, {
        params: { sectionId: selSec || undefined },
      });
      setResults(r.data.data.results);
      setSubjects(r.data.data.subjects);
    } catch {
      setError('Failed to load results.');
    } finally {
      setLoading(false);
    }
  }, [selSem, selSec]);

  useEffect(() => { load(); }, [load]);

  async function handlePdf(studentId: string) {
    setGenPdf(studentId);
    try {
      const url = `/api/reports/result-card/${studentId}?semesterId=${selSem}`;
      window.open(url, '_blank');
    } finally {
      setGenPdf(null);
    }
  }

  function handleExportCsv() {
    const url = `/api/reports/csv/results?semesterId=${selSem}${selSec ? `&sectionId=${selSec}` : ''}`;
    window.open(url, '_blank');
  }

  const filtered = results.filter((r: any) =>
    !search ||
    r.student.fullName.toLowerCase().includes(search.toLowerCase()) ||
    r.student.enrollmentNumber.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1;
    if (b.rank) return 1;
    return 0;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Results</h1>
          <p className="page-sub">Semester-wise results and rankings</p>
        </div>
        {selSem && (
          <button onClick={handleExportCsv} className="btn btn-sm">
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="label">Semester</label>
          <div className="relative">
            <select value={selSem} onChange={(e) => { setSelSem(e.target.value); setResults([]); }} className="input pr-8 appearance-none">
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
        {selSem && (
          <div className="flex flex-col gap-1">
            <label className="label">Search</label>
            <input
              type="search"
              placeholder="Name or enrollment…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-bad bg-bad-light border border-bad/20 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {selSem && (
        loading ? (
          <div className="flex items-center justify-center h-48 text-ink-secondary gap-2">
            <Loader2 size={16} className="animate-spin" /> Computing results…
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl text-sm">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Enrollment</th>
                  <th>Section</th>
                  {subjects.map((s: any) => (
                    <th key={s.id} className="text-center">{s.code}</th>
                  ))}
                  <th className="text-right">Total</th>
                  <th className="text-right">%</th>
                  <th className="text-right">SGPA</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th className="text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={12 + subjects.length} className="text-center py-10 text-ink-secondary">
                      No results found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  sorted.map((r: any) => (
                    <tr key={r.student.id}>
                      <td className="font-semibold text-ink-secondary">
                        {r.rank ?? '—'}
                      </td>
                      <td className="font-medium">{r.student.fullName}</td>
                      <td className="font-mono text-xs">{r.student.enrollmentNumber}</td>
                      <td>{r.section?.name ?? '—'}</td>
                      {subjects.map((s: any) => {
                        const sr = r.result.subjects.find((x: any) => x.subjectId === s.id);
                        return (
                          <td key={s.id} className="text-center tabular-nums">
                            {sr?.obtained !== null && sr?.obtained !== undefined ? (
                              <span className={sr.status === 'FAIL' ? 'text-bad font-medium' : ''}>
                                {sr.obtained}
                              </span>
                            ) : (
                              <span className="text-ink-secondary/40">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-right tabular-nums">
                        {r.result.totalObtained} / {r.result.totalMax}
                      </td>
                      <td className="text-right tabular-nums">{fmtPct(r.result.overallPercentage)}</td>
                      <td className="text-right tabular-nums font-semibold">{fmt2(r.result.sgpa)}</td>
                      <td>
                        {r.result.overallGrade ? (
                          <span className="pill-grade pill text-xs">{r.result.overallGrade}</span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`pill ${statusClass(r.result.status)}`}>
                          {statusLabel(r.result.status)}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handlePdf(r.student.id)}
                          disabled={genPdf === r.student.id || r.result.status === 'PENDING'}
                          className="btn btn-sm"
                          title="Download PDF"
                        >
                          {genPdf === r.student.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <FileDown size={12} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {!selSem && (
        <div className="card-p text-sm text-ink-secondary text-center py-12">
          Select a semester above to view results and rankings.
        </div>
      )}
    </div>
  );
}
