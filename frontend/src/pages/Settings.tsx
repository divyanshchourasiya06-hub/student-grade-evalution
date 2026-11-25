import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, Check } from 'lucide-react';

const schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
  confirmPassword: z.string().min(1),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverMsg, setServerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setServerMsg(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setServerMsg({ type: 'ok', text: 'Password updated successfully.' });
      reset();
    } catch (e: any) {
      setServerMsg({ type: 'err', text: e.response?.data?.error ?? 'Failed to update password.' });
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your account preferences.</p>
      </div>

      {/* Account info */}
      <div className="card-p space-y-2">
        <h2 className="text-base font-semibold mb-3">Account</h2>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-secondary">Email</span>
          <span className="text-sm font-medium">{user?.email}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-secondary">Role</span>
          <span className="text-sm font-medium">{user?.role}</span>
        </div>
      </div>

      {/* Change password */}
      <div className="card-p">
        <h2 className="text-base font-semibold mb-4">Change Password</h2>

        {serverMsg && (
          <div className={`flex items-center gap-2 text-sm rounded px-3 py-2 mb-4 ${
            serverMsg.type === 'ok'
              ? 'bg-ok-light text-ok border border-ok/20'
              : 'bg-bad-light text-bad border border-bad/20'
          }`}>
            {serverMsg.type === 'ok' && <Check size={14} />}
            {serverMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Current */}
          <div>
            <label className="label">Current password</label>
            <div className="relative">
              <input
                type={showCur ? 'text' : 'password'}
                className={`input pr-10 ${errors.currentPassword ? 'input-error' : ''}`}
                {...register('currentPassword')}
              />
              <button type="button" onClick={() => setShowCur((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary" tabIndex={-1}>
                {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.currentPassword && <p className="mt-1 text-xs text-bad">{errors.currentPassword.message}</p>}
          </div>

          {/* New */}
          <div>
            <label className="label">New password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className={`input pr-10 ${errors.newPassword ? 'input-error' : ''}`}
                {...register('newPassword')}
              />
              <button type="button" onClick={() => setShowNew((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary" tabIndex={-1}>
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1 text-xs text-bad">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm */}
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-bad">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary btn-sm">
            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
