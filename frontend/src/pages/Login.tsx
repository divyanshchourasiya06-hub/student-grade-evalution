import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.data.token, res.data.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setServerError(
        err.response?.data?.error ?? 'Login failed. Please check your credentials.'
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-800 text-white mb-3">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-ink-primary">Student Grade Evaluation</h1>
          <p className="text-sm text-ink-secondary mt-1">B.Tech CSBS · MITS Gwalior</p>
        </div>

        {/* Card */}
        <div className="card-p">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError && (
              <div className="rounded bg-bad-light border border-bad/20 px-3 py-2 text-sm text-bad">
                {serverError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@mits.ac.in"
                className={`input ${errors.email ? 'input-error' : ''}`}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-bad">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-bad">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn-lg w-full justify-center"
            >
              {isSubmitting ? (
                <><Loader2 size={15} className="animate-spin" /> Signing in…</>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-secondary mt-4">
          Contact your administrator if you have forgotten your credentials.
        </p>
      </div>
    </div>
  );
}
