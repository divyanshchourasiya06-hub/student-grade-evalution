import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/services/api';

type Semester   = { id: string; label: string; number: number };

interface Props {
  subject: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const schema = z.object({
  name: z.string().min(2, 'Subject name must be at least 2 characters.').max(100),
  code: z.string().min(2, 'Subject code is required.').max(20),
  maxMarks: z.coerce.number().int().min(1).max(1000),
  credits: z.coerce.number().min(0).max(10),
  type: z.enum(['THEORY', 'PRACTICAL', 'PROJECT']),
  semesterId: z.string().min(1, 'Select a semester.'),
  departmentId: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function SubjectModal({ subject, onClose, onSaved }: Props) {
  const isEdit = !!subject;
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [serverErr, setServerErr] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: subject ? {
      name: subject.name,
      code: subject.code,
      maxMarks: subject.maxMarks,
      credits: subject.credits,
      type: subject.type,
      semesterId: subject.semester?.id ?? '',
      departmentId: subject.department?.id ?? '__csbs__',
    } : {
      maxMarks: 100,
      credits: 3,
      type: 'THEORY',
      departmentId: '__csbs__',
    },
  });

  useEffect(() => {
    api.get('/semesters').then((r) => setSemesters(r.data.data)).catch(() => {});
  }, []);

  async function onSubmit(data: FormData) {
    setServerErr('');
    try {
      if (isEdit) {
        await api.patch(`/subjects/${subject.id}`, data);
      } else {
        await api.post('/subjects', data);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setServerErr(e.response?.data?.error ?? 'Failed to save subject.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-xl border border-surface-border shadow-dropdown w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Subject' : 'Add Subject'}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm -mr-1"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4" noValidate>
          {serverErr && (
            <div className="bg-bad-light border border-bad/20 text-bad rounded px-3 py-2 text-sm">
              {serverErr}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Subject Name *</label>
              <input className={`input ${errors.name ? 'input-error' : ''}`} {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-bad">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Subject Code *</label>
              <input className={`input font-mono ${errors.code ? 'input-error' : ''}`} {...register('code')} placeholder="e.g. CS101" />
              {errors.code && <p className="mt-1 text-xs text-bad">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" {...register('type')}>
                <option value="THEORY">Theory</option>
                <option value="PRACTICAL">Practical</option>
                <option value="PROJECT">Project</option>
              </select>
            </div>
            <div>
              <label className="label">Maximum Marks</label>
              <input type="number" min={1} className="input" {...register('maxMarks')} />
            </div>
            <div>
              <label className="label">Credits</label>
              <input type="number" min={0} step={0.5} className="input" {...register('credits')} />
            </div>
            <div className="col-span-2">
              <label className="label">Semester *</label>
              <select className={`input ${errors.semesterId ? 'input-error' : ''}`} {...register('semesterId')}>
                <option value="">Select semester</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {errors.semesterId && <p className="mt-1 text-xs text-bad">{errors.semesterId.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
            <button type="button" onClick={onClose} className="btn btn-sm">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary btn-sm">
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Add subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
