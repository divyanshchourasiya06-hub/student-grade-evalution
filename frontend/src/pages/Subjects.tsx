import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import SubjectModal from '@/components/ui/SubjectModal';

type Subject = {
  id: string;
  name: string;
  code: string;
  maxMarks: number;
  credits: number;
  type: string;
  semester: { label: string; number: number };
  department: { name: string; code: string };
};

export default function SubjectsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/subjects');
      setSubjects(r.data.data);
    } catch {
      setError('Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this subject? Subjects with existing marks cannot be deleted.')) return;
    setDeleting(id);
    try {
      await api.delete(`/subjects/${id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed to delete subject.');
    } finally {
      setDeleting(null);
    }
  }

  const typeBadge: Record<string, string> = {
    THEORY: 'bg-navy-50 text-navy-800',
    PRACTICAL: 'bg-ok-light text-ok',
    PROJECT: 'bg-warn-light text-warn',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-sub">{subjects.length} subjects configured</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="btn-primary btn-sm"
          >
            <Plus size={13} /> Add subject
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-bad bg-bad-light border border-bad/20 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject Name</th>
              <th>Semester</th>
              <th>Department</th>
              <th>Max Marks</th>
              <th>Credits</th>
              <th>Type</th>
              {isAdmin && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-ink-secondary">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading…
                </td>
              </tr>
            ) : subjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-ink-secondary">
                  No subjects configured yet.
                </td>
              </tr>
            ) : (
              subjects.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs font-semibold">{s.code}</td>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.semester.label}</td>
                  <td>{s.department.code}</td>
                  <td className="tabular-nums">{s.maxMarks}</td>
                  <td className="tabular-nums">{s.credits}</td>
                  <td>
                    <span className={`pill text-2xs ${typeBadge[s.type] ?? 'bg-surface-bg text-ink-secondary'}`}>
                      {s.type}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditTarget(s); setModalOpen(true); }}
                          className="btn btn-sm"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting === s.id}
                          className="btn btn-sm text-bad hover:bg-bad-light hover:border-bad/30"
                        >
                          {deleting === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SubjectModal
          subject={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
