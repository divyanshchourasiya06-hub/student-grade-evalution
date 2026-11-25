import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, Upload, Trash2, Pencil, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import StudentModal from '@/components/ui/StudentModal';

type Student = {
  id: string;
  fullName: string;
  enrollmentNumber: string;
  email: string;
  phone?: string;
  department: { name: string; code: string };
  academicYear: { label: string };
  enrollments: { semester: { label: string }; section: { name: string } }[];
};

type Meta = { total: number; page: number; limit: number; pages: number };

export default function StudentsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/students', {
        params: { page, limit: 50, search: search || undefined },
      });
      setStudents(r.data.data);
      setMeta(r.data.meta);
    } catch {
      setError('Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this student? This action cannot be undone.')) return;
    setDeleting(id);
    try {
      await api.delete(`/students/${id}`);
      load();
    } catch {
      alert('Failed to delete student.');
    } finally {
      setDeleting(null);
    }
  }

  async function handleExportCsv() {
    const url = '/api/reports/csv/students';
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">{meta.total} total students</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportCsv} className="btn btn-sm">
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="btn-primary btn-sm"
            >
              <Plus size={13} /> Add student
            </button>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-secondary" />
        <input
          type="search"
          placeholder="Search name or enrollment…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input pl-8"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-bad bg-bad-light border border-bad/20 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Enrollment</th>
              <th>Department</th>
              <th>Semester / Section</th>
              <th>Academic Year</th>
              {isAdmin && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-ink-secondary">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading…
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-ink-secondary">
                  {search ? 'No students match your search.' : 'No students added yet.'}
                </td>
              </tr>
            ) : (
              students.map((s, idx) => (
                <tr key={s.id}>
                  <td className="text-ink-secondary">{(page - 1) * 50 + idx + 1}</td>
                  <td>
                    <Link to={`/students/${s.id}`} className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
                      {s.fullName}
                    </Link>
                    <div className="text-xs text-ink-secondary">{s.email}</div>
                  </td>
                  <td className="font-mono text-xs">{s.enrollmentNumber}</td>
                  <td>{s.department.code}</td>
                  <td>
                    {s.enrollments.length > 0
                      ? s.enrollments.map((e) => `${e.semester.label} / ${e.section.name}`).join(', ')
                      : <span className="text-ink-secondary text-xs">Not enrolled</span>
                    }
                  </td>
                  <td>{s.academicYear.label}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditTarget(s); setModalOpen(true); }}
                          className="btn btn-sm"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting === s.id}
                          className="btn btn-sm text-bad hover:bg-bad-light hover:border-bad/30"
                          title="Delete"
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

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center gap-2 justify-end text-sm">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm">
            <ChevronLeft size={13} />
          </button>
          <span className="text-ink-secondary">Page {page} of {meta.pages}</span>
          <button onClick={() => setPage((p) => Math.min(meta.pages, p + 1))} disabled={page === meta.pages} className="btn btn-sm">
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <StudentModal
          student={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
