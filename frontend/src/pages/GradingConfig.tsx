import { useEffect, useState, useCallback } from 'react';
import { Save, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

type ScaleEntry = {
  id: string;
  grade: string;
  minPercent: number;
  gradePoint: number;
  remark: string;
  sortOrder: number;
};

export default function GradingConfigPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [scale, setScale]     = useState<ScaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/grading-scales');
      setScale(r.data.data);
    } catch {
      setError('Failed to load grading scale.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const entries = scale.map((e) => ({
        grade: e.grade,
        minPercent: e.minPercent,
        gradePoint: e.gradePoint,
        remark: e.remark,
      }));
      await api.put('/grading-scales', { entries });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to save grading scale.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset to default 10-point grading scale? All custom changes will be lost.')) return;
    setSaving(true);
    try {
      await api.post('/grading-scales/reset');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } catch {
      setError('Failed to reset grading scale.');
    } finally {
      setSaving(false);
    }
  }

  function update(idx: number, field: keyof ScaleEntry, value: string | number) {
    setScale((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="page-title">Grading Scale Configuration</h1>
        <p className="page-sub">
          Adjust the minimum percentage thresholds. All results recalculate automatically.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-bad bg-bad-light border border-bad/20 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-ink-secondary gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="tbl-wrap">
            <table className="tbl text-sm">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Minimum %</th>
                  <th>Grade Point</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {scale.map((entry, idx) => (
                  <tr key={entry.id ?? idx}>
                    <td>
                      <span className={`pill font-bold text-xs ${entry.gradePoint === 0 ? 'pill-fail' : 'pill-grade'}`}>
                        {entry.grade}
                      </span>
                    </td>
                    <td>
                      {entry.minPercent === 0 ? (
                        <span className="text-ink-secondary text-xs">Below previous threshold (Fail)</span>
                      ) : isAdmin ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={entry.minPercent}
                          onChange={(e) => update(idx, 'minPercent', parseFloat(e.target.value) || 0)}
                          className="input w-20 text-center"
                        />
                      ) : (
                        `${entry.minPercent}%`
                      )}
                    </td>
                    <td className="tabular-nums font-semibold">{entry.gradePoint}</td>
                    <td>
                      {isAdmin ? (
                        <input
                          type="text"
                          value={entry.remark}
                          onChange={(e) => update(idx, 'remark', e.target.value)}
                          className="input"
                          maxLength={50}
                        />
                      ) : (
                        entry.remark
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save scale
              </button>
              <button onClick={handleReset} disabled={saving} className="btn btn-sm">
                <RotateCcw size={13} /> Reset to default
              </button>
              {saved && <span className="text-sm text-ok font-medium">Scale saved ✓</span>}
            </div>
          )}

          <div className="card-p">
            <h2 className="text-sm font-semibold mb-2">How SGPA is calculated</h2>
            <div className="text-sm text-ink-secondary space-y-1">
              <p>Subject percentage = (Marks Obtained / Maximum Marks) × 100</p>
              <p>SGPA = Σ (Grade Point × Credits) / Total Credits</p>
              <p>Overall % = (Total Obtained / Total Maximum) × 100</p>
              <p className="text-xs pt-1">SGPA is not calculated until all subjects have marks entered.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
