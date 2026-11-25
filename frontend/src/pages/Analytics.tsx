import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '@/services/api';
import { fmtPct, fmt2 } from '@/utils/helpers';

type Semester = { id: string; label: string };
type SubjectStat = {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  credits: number;
  entryCount: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  passPercent: number | null;
};

export default function AnalyticsPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selSem, setSelSem] = useState('');
  const [subStats, setSubStats] = useState<SubjectStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/semesters').then((r) => setSemesters(r.data.data));
  }, []);

  const load = useCallback(async () => {
    if (!selSem) return;
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/analytics/subjects', { params: { semesterId: selSem } });
      setSubStats(r.data.data);
    } catch {
      setError('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [selSem]);

  useEffect(() => { load(); }, [load]);

  const chartData = subStats.map((s) => ({
    name: s.subjectCode,
    avg: s.average !== null ? parseFloat(s.average.toFixed(1)) : 0,
    highest: s.highest ?? 0,
    lowest: s.lowest ?? 0,
    passPercent: s.passPercent !== null ? parseFloat(s.passPercent.toFixed(1)) : 0,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Class Analytics</h1>
        <p className="page-sub">Subject-wise performance breakdown</p>
      </div>

      {/* Semester selector */}
      <div className="flex flex-col gap-1 max-w-xs">
        <label className="label">Semester</label>
        <div className="relative">
          <select
            value={selSem}
            onChange={(e) => { setSelSem(e.target.value); setSubStats([]); }}
            className="input pr-8 appearance-none"
          >
            <option value="">Select semester</option>
            {semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-bad bg-bad-light border border-bad/20 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {selSem && loading && (
        <div className="flex items-center justify-center h-48 text-ink-secondary gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading analytics…
        </div>
      )}

      {!loading && selSem && subStats.length > 0 && (
        <>
          {/* Average marks chart */}
          <div className="card-p">
            <h2 className="text-base font-semibold mb-4">Average Marks per Subject</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: '1px solid #E5E8ED' }}
                  formatter={(v: number, name: string) => [v, name === 'avg' ? 'Average' : name === 'highest' ? 'Highest' : 'Lowest']}
                />
                <Bar dataKey="avg" fill="#1E4D8C" radius={[3, 3, 0, 0]} maxBarSize={36} name="avg" />
                <Bar dataKey="highest" fill="#17803D" radius={[3, 3, 0, 0]} maxBarSize={28} name="highest" />
                <Bar dataKey="lowest" fill="#B42318" radius={[3, 3, 0, 0]} maxBarSize={28} name="lowest" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Subject table */}
          <div className="tbl-wrap">
            <table className="tbl text-sm">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Max</th>
                  <th>Credits</th>
                  <th className="text-right">Entries</th>
                  <th className="text-right">Average</th>
                  <th className="text-right">Highest</th>
                  <th className="text-right">Lowest</th>
                  <th className="text-right">Pass %</th>
                </tr>
              </thead>
              <tbody>
                {subStats.map((s) => (
                  <tr key={s.subjectId}>
                    <td className="font-medium">{s.subjectName}</td>
                    <td className="font-mono text-xs">{s.subjectCode}</td>
                    <td className="tabular-nums">{s.maxMarks}</td>
                    <td className="tabular-nums">{s.credits}</td>
                    <td className="text-right tabular-nums">{s.entryCount}</td>
                    <td className="text-right tabular-nums">{s.average !== null ? s.average.toFixed(1) : '—'}</td>
                    <td className="text-right tabular-nums text-ok font-medium">{s.highest ?? '—'}</td>
                    <td className="text-right tabular-nums text-bad font-medium">{s.lowest ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {s.passPercent !== null ? (
                        <span className={s.passPercent < 50 ? 'text-bad' : 'text-ok'}>
                          {fmtPct(s.passPercent)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selSem && (
        <div className="card-p text-sm text-ink-secondary text-center py-12">
          Select a semester to view analytics.
        </div>
      )}
    </div>
  );
}
