export interface StaffTheme {
  primary: string;
  bg: string;
  bgCard: string;
  bgHover: string;
  border: string;
  borderHeader: string;
  borderLeft: string;
  text: string;
  textDark: string;
  badge: string;
  dot: string;
  shadow: string;
  accent: string;
}

export const STAFF_THEMES: Record<string, StaffTheme> = {
  'นางสาววรินทร ปัดกอง': {
    primary: 'indigo-600',
    bg: 'bg-indigo-50/70',
    bgCard: 'bg-indigo-50/30',
    bgHover: 'hover:bg-indigo-100/50',
    border: 'border-indigo-100',
    borderHeader: 'border-indigo-200',
    borderLeft: 'border-l-indigo-500',
    text: 'text-indigo-700',
    textDark: 'text-indigo-950',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-100/60',
    dot: 'bg-indigo-500',
    shadow: 'shadow-indigo-100/50',
    accent: 'indigo'
  },
  'นายสากล ชนะบูรณ์': {
    primary: 'amber-600',
    bg: 'bg-amber-50/70',
    bgCard: 'bg-amber-50/30',
    bgHover: 'hover:bg-amber-100/50',
    border: 'border-amber-100',
    borderHeader: 'border-amber-200',
    borderLeft: 'border-l-amber-500',
    text: 'text-amber-800',
    textDark: 'text-amber-950',
    badge: 'bg-amber-50 text-amber-800 border-amber-100/60',
    dot: 'bg-amber-500',
    shadow: 'shadow-amber-100/50',
    accent: 'amber'
  },
  'นายจักรวาล เขียวดีเจริญกุล': {
    primary: 'emerald-600',
    bg: 'bg-emerald-50/70',
    bgCard: 'bg-emerald-50/30',
    bgHover: 'hover:bg-emerald-100/50',
    border: 'border-emerald-100',
    borderHeader: 'border-emerald-200',
    borderLeft: 'border-l-emerald-500',
    text: 'text-emerald-700',
    textDark: 'text-emerald-950',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100/60',
    dot: 'bg-emerald-500',
    shadow: 'shadow-emerald-100/50',
    accent: 'emerald'
  },
  'นางสาวญาสุมินทร์ นนทมาตร': {
    primary: 'rose-600',
    bg: 'bg-rose-50/70',
    bgCard: 'bg-rose-50/30',
    bgHover: 'hover:bg-rose-100/50',
    border: 'border-rose-100',
    borderHeader: 'border-rose-200',
    borderLeft: 'border-l-rose-500',
    text: 'text-rose-700',
    textDark: 'text-rose-950',
    badge: 'bg-rose-50 text-rose-700 border-rose-100/60',
    dot: 'bg-rose-500',
    shadow: 'shadow-rose-100/50',
    accent: 'rose'
  }
};

export const DEFAULT_THEME: StaffTheme = {
  primary: 'slate-600',
  bg: 'bg-slate-50/70',
  bgCard: 'bg-slate-50/30',
  bgHover: 'hover:bg-slate-100/50',
  border: 'border-slate-100',
  borderHeader: 'border-slate-200',
  borderLeft: 'border-l-slate-400',
  text: 'text-slate-700',
  textDark: 'text-slate-900',
  badge: 'bg-slate-50 text-slate-700 border-slate-100/60',
  dot: 'bg-slate-500',
  shadow: 'shadow-slate-100/50',
  accent: 'slate'
};

export function getStaffTheme(name?: string): StaffTheme {
  if (!name) return DEFAULT_THEME;
  return STAFF_THEMES[name] || DEFAULT_THEME;
}

export function getStaffThemesForList(names?: string[]): StaffTheme[] {
  if (!names || names.length === 0) return [DEFAULT_THEME];
  return names.map(name => getStaffTheme(name));
}
