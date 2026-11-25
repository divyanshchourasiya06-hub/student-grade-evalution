import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import AppShell from '@/components/layout/AppShell';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import StudentsPage from '@/pages/Students';
import StudentProfilePage from '@/pages/StudentProfile';
import SubjectsPage from '@/pages/Subjects';
import MarksPage from '@/pages/Marks';
import ResultsPage from '@/pages/Results';
import AnalyticsPage from '@/pages/Analytics';
import ReportsPage from '@/pages/Reports';
import GradingConfigPage from '@/pages/GradingConfig';
import SettingsPage from '@/pages/Settings';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentProfilePage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="marks" element={<MarksPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="grading" element={<GradingConfigPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
