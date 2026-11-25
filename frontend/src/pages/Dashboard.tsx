import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, TrendingUp, Award, BarChart2, Loader2, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '@/services/api';
import { fmtPct, fmt2, statusClass, statusLabel } from '@/utils/helpers';

type DashData = {
  totalStudents: number;
  totalSubjects: number;
  classStats: {
    semesterLabel: string;
    evaluated: number;
    pending: number;
    passCount: number;
    failCount: number;
    passPercent: number | null;
    classAvgPercent: number | null;
    highestSgpa: number | null;
    topper: { fullName: string; enrollmentNumber: string } | null;
    gradeDistribution: { grade: string; count: number; percentage: number }[];
  } | null;
  recentStudents: { fullName: string; enrollmentNumber: string; createdAt: string }[];
  recentMarks: { student: string; subject: string; obtained: number; updatedAt: string }[];
};

const PIE_COLORS = ['#17803D', '#B42318', '#9A5B00', '#1E4D8C'];

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/dashboard')
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-ink-secondary gap-2">
      <Loader2 size={18} className="animate-spin" /> Loading dashboard…
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-bad bg-bad-light border border-bad/20 rounded px-4 py-3">
      <AlertCircle size={16} /> {error}
    </div>
  );

  const cs = data?.classStats;

  const statCards = [
    { label: 'Total Students', value: data?.totalStudents ?? 0, icon: Users, to: '/students' },
    { label: 'Total Subjects', value: data?.totalSubjects ?? 0, icon: BookOpen, to: '/subjects' },
    { label: 'Evaluated', value: cs?.evaluated ?? 0, icon: TrendingUp, to: '/results' },
    { label: 'Class Average', value: fmtPct(cs?.classAvgPercent), icon: BarChart2, to: '/analytics' },
  ];

  const passFailData = cs
    ? [
        { name: 'Pass', value: cs.passCount },
        { name: 'Fail', value: cs.failCount },
        { name: 'Pending', value: cs.pending },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        {cs && <p className="page-sub">{cs.semesterLabel} · Class overview</p>}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="stat-card hover:shadow-dropdown transition-shadow">
            <div className="flex items-center justify-between">
              <span className="stat-label">{label}</span>
              <Icon size={14} className="text-ink-secondary/60" />
            </div>
            <span className="stat-value">{value}</span>
          </Link>
        ))}
      </div>

      {cs && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Grade distribution bar */}
          <div className="card-p">
            <h2 className="text-base font-semibold mb-3">Grade Distribution</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cs.gradeDistribution} margin={{ left: -20 }}>
                <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [v, 'Students']}
                  contentStyle={{ fontSize: 12, border: '1px solid #E5E8ED' }}
                />
                <Bar dataKey="count" fill="#1E4D8C" radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pass/fail pie */}
          <div className="card-p">
            <h2 className="text-base font-semibold mb-3">Pass / Fail / Pending</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={passFailData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {passFailData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [v, 'Students']} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary cards row */}
      {cs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pass %', value: fmtPct(cs.passPercent) },
            { label: 'Fail count', value: cs.failCount },
            { label: 'Highest SGPA', value: fmt2(cs.highestSgpa) },
            { label: 'Class Topper', value: cs.topper?.fullName ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card">
              <span className="stat-label">{label}</span>
              <span className="stat-value text-lg truncate">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-p">
          <h2 className="text-base font-semibold mb-3">Recent Students</h2>
          {data?.recentStudents.length === 0 && (
            <p className="text-sm text-ink-secondary">No students yet.</p>
          )}
          <ul className="divide-y divide-surface-border">
            {data?.recentStudents.map((s) => (
              <li key={s.enrollmentNumber} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium text-ink-primary">{s.fullName}</div>
                  <div className="text-ink-secondary text-xs">{s.enrollmentNumber}</div>
                </div>
                <span className="text-xs text-ink-secondary">
                  {new Date(s.createdAt).toLocaleDateString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/students" className="mt-3 inline-block text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
            View all students →
          </Link>
        </div>

        <div className="card-p">
          <h2 className="text-base font-semibold mb-3">Recent Mark Updates</h2>
          {data?.recentMarks.length === 0 && (
            <p className="text-sm text-ink-secondary">No marks entered yet.</p>
          )}
          <ul className="divide-y divide-surface-border">
            {data?.recentMarks.map((m, i) => (
              <li key={i} className="py-2 text-sm flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{m.student}</span>
                  <span className="text-ink-secondary"> — {m.subject}</span>
                </div>
                <span className="font-semibold tabular-nums">{m.obtained}</span>
              </li>
            ))}
          </ul>
          <Link to="/marks" className="mt-3 inline-block text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
            Enter marks →
          </Link>
        </div>
      </div>
    </div>
  );
}
