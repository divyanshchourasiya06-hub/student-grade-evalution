import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt2(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2) + '%';
}

export function statusClass(status: string): string {
  switch (status) {
    case 'PASS': return 'pill-pass';
    case 'FAIL': return 'pill-fail';
    case 'INCOMPLETE': return 'pill-inc';
    default: return 'pill-pend';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'PASS': return 'Pass';
    case 'FAIL': return 'Fail';
    case 'INCOMPLETE': return 'Incomplete';
    case 'PENDING': return 'Pending';
    default: return status;
  }
}
