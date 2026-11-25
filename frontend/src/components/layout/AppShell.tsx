import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Trophy,
  BarChart2,
  FileText,
  Settings2,
  SlidersHorizontal,
  LogOut,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/helpers';

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/students',   label: 'Students',       icon: Users },
  { to: '/subjects',   label: 'Subjects',       icon: BookOpen },
  { to: '/marks',      label: 'Marks',          icon: ClipboardList },
  { to: '/results',    label: 'Results',        icon: Trophy },
  { to: '/analytics',  label: 'Analytics',      icon: BarChart2 },
  { to: '/reports',    label: 'Reports',        icon: FileText },
  { to: '/grading',    label: 'Grading Scale',  icon: SlidersHorizontal },
  { to: '/settings',   label: 'Settings',       icon: Settings2 },
];

export default function AppShell() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-surface-border">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-navy-800 text-white">
          <GraduationCap size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink-primary leading-tight">SGES 2.0</div>
          <div className="text-2xs text-ink-secondary">Grade Evaluation</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn('nav-item', isActive && 'active')
            }
          >
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-2 py-3 border-t border-surface-border">
        <div className="px-3 py-2 mb-1">
          <div className="text-xs font-medium text-ink-primary truncate">{user?.email}</div>
          <div className="text-2xs text-ink-secondary">{user?.role}</div>
        </div>
        <button onClick={handleLogout} className="nav-item w-full text-bad hover:text-bad hover:bg-bad-light">
          <LogOut size={15} className="shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-[var(--sidebar-width)] shrink-0 bg-white border-r border-surface-border"
        style={{ '--sidebar-width': '220px' } as React.CSSProperties}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-surface-border z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-border">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost btn-sm -ml-1">
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-navy-800" />
            <span className="text-sm font-semibold">SGES 2.0</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
