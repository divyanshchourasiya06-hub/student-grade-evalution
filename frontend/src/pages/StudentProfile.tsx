import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { fmtPct, fmt2, statusClass, statusLabel } from '@/utils/helpers';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/students/${id}`)
      .then((r) => setStudent(r.data.data))
      .catch(() => setError('Failed to load student profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-ink-secondary gap-2">
      <Loader2 size={18} className="animate-spin" /> Loading profile…
    </div>
  );

  if (error || !student) return (
    <div className="flex items-center gap-2 text-bad bg-bad-light border border-bad/20 rounded px-4 py-3">
      <AlertCircle size={16} /> {error || 'Student not found.'}
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link to="/students" className="text-sm text-ink-secondary hover:text-ink-primary flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> Back to students
        </Link>
        <h1 className="page-title">{student.fullName}</h1>
        <p className="page-sub">{student.enrollmentNumber} · {student.department?.code}</p>
      </div>

      {/* Info card */}
      <div className="card-p">
        <h2 className="text-base font-semibold mb-3">Personal Information</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            ['Full Name', student.fullName],
            ['Enrollment No.', student.enrollmentNumber],
            ['Email', student.email],
            ['Phone', student.phone || '—'],
            ['Department', student.department?.name],
            ['Academic Year', student.academicYear?.label],
            ['Admission Date', new Date(student.admissionDate).toLocaleDateString('en-IN')],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs text-ink-secondary">{label}</dt>
              <dd className="font-medium text-ink-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Enrollments */}
      {student.enrollments?.length > 0 && (
        <div className="card-p">
          <h2 className="text-base font-semibold mb-3">Enrollments</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {student.enrollments.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.semester.label}</td>
                    <td>{e.section.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Marks summary */}
      {student.marks?.length > 0 && (
        <div className="card-p">
          <h2 className="text-base font-semibold mb-3">Marks History</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Semester</th>
                  <th>Obtained</th>
                  <th>Max</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {student.marks.map((m: any) => {
                  const pct = (m.obtained / m.subject.maxMarks) * 100;
                  return (
                    <tr key={m.id}>
                      <td>{m.subject.name}</td>
                      <td>{m.semester.label}</td>
                      <td className="font-medium tabular-nums">{m.obtained}</td>
                      <td className="text-ink-secondary tabular-nums">{m.subject.maxMarks}</td>
                      <td className="tabular-nums">{fmtPct(pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
