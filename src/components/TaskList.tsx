import { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { Plus, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, LayoutList, Calendar as CalendarIcon, Paperclip, X } from 'lucide-react';
import TaskForm from './TaskForm';
import { getStaffTheme } from '../utils/staffColors';

const STAFF_MEMBERS = [
  'นางสาววรินทร ปัดกอง',
  'นายสากล ชนะบูรณ์',
  'นายจักรวาล เขียวดีเจริญกุล',
  'นางสาวญาสุมินทร์ นนทมาตร'
];

const THAI_HOLIDAYS: Record<string, string> = {
  '01-01': 'วันขึ้นปีใหม่',
  '01-16': 'วันครู',
  '02-24': 'วันมาฆบูชา',
  '04-06': 'วันจักรี',
  '04-13': 'วันสงกรานต์',
  '04-14': 'วันสงกรานต์',
  '04-15': 'วันสงกรานต์',
  '05-01': 'วันแรงงานแห่งชาติ',
  '05-04': 'วันฉัตรมงคล',
  '05-22': 'วันวิสาขบูชา',
  '06-03': 'วันเฉลิมพระชนมพรรษาพระบรมราชินี',
  '07-20': 'วันอาสาฬหบูชา',
  '07-21': 'วันเข้าพรรษา',
  '07-28': 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10',
  '08-12': 'วันแม่แห่งชาติ',
  '10-13': 'วันนวมินทรมหาราช',
  '10-23': 'วันปิยมหาราช',
  '12-05': 'วันพ่อแห่งชาติ (วันชาติ)',
  '12-10': 'วันรัฐธรรมนูญ',
  '12-31': 'วันสิ้นปี'
};

export default function TaskList({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState<Date | null>(null);

  // Set default viewMode to 'list' on mobile screens on mount
  useEffect(() => {
    if (window.innerWidth < 768) {
      setViewMode('list');
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskData);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      console.error("Error deleting task", error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Task['status']) => {
    await setDoc(doc(db, 'tasks', id), { status: newStatus }, { merge: true });
  };

  const canEdit = user?.role === 'staff' || user?.role === 'executive';

  const priorityBadge = (priority: Task['priority']) => {
    const styles = {
      high: 'bg-red-600 text-white',
      medium: 'bg-orange-500 text-white',
      low: 'bg-blue-600 text-white'
    };
    const labels = { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' };
    return <span className={`px-2 py-1 rounded-md text-[10px] font-bold shadow-sm ${styles[priority]}`}>{labels[priority]}</span>;
  };

  const statusBadge = (status: Task['status']) => {
    const config = {
      pending: { icon: AlertCircle, color: 'text-slate-400', bg: 'bg-transparent', label: 'รอดำเนินการ' },
      in_progress: { icon: Clock, color: 'text-orange-500', bg: 'bg-transparent', label: 'กำลังดำเนินการ' },
      completed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-transparent', label: 'เสร็จสิ้น' },
    };
    const { icon: Icon, color, bg, label } = config[status];
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${bg} ${color}`}>
        <Icon className="w-4 h-4" />
        {label}
      </div>
    );
  };

  const getLocalDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };

  const dateBadge = (dateStr: string) => {
    const dateObj = getLocalDate(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0-6
    
    // Thailand day of the week colors configuration:
    // Sunday: Red
    // Monday: Yellow
    // Tuesday: Pink
    // Wednesday: Green
    // Thursday: Orange
    // Friday: Blue
    // Saturday: Purple
    const dayStyles = [
      { // 0: Sunday
        bg: 'bg-rose-50 text-rose-700 border-rose-200/60',
        dot: 'bg-rose-500',
        label: 'วันอาทิตย์'
      },
      { // 1: Monday
        bg: 'bg-amber-50 text-amber-800 border-amber-200/60',
        dot: 'bg-amber-400',
        label: 'วันจันทร์'
      },
      { // 2: Tuesday
        bg: 'bg-pink-50 text-pink-700 border-pink-200/60',
        dot: 'bg-pink-500',
        label: 'วันอังคาร'
      },
      { // 3: Wednesday
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        dot: 'bg-emerald-500',
        label: 'วันพุธ'
      },
      { // 4: Thursday
        bg: 'bg-orange-50 text-orange-700 border-orange-200/60',
        dot: 'bg-orange-500',
        label: 'วันพฤหัสบดี'
      },
      { // 5: Friday
        bg: 'bg-sky-50 text-sky-700 border-sky-200/60',
        dot: 'bg-sky-500',
        label: 'วันศุกร์'
      },
      { // 6: Saturday
        bg: 'bg-purple-50 text-purple-700 border-purple-200/60',
        dot: 'bg-purple-500',
        label: 'วันเสาร์'
      }
    ];

    const style = dayStyles[dayOfWeek] || {
      bg: 'bg-slate-50 text-slate-700 border-slate-200/60',
      dot: 'bg-slate-400',
      label: 'ไม่ระบุ'
    };

    const formattedDate = format(dateObj, 'dd MMM yyyy', { locale: th });
    const holidayKey = format(dateObj, 'MM-dd');
    const holidayName = THAI_HOLIDAYS[holidayKey];

    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xs ${style.bg}`}>
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <span className="opacity-90">{style.label}</span>
          <span className="opacity-40 font-normal">|</span>
          <span>{formattedDate}</span>
        </span>
        {holidayName && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded-xl shadow-2xs">
            🎉 {holidayName}
          </span>
        )}
      </div>
    );
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const weekDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

  const filteredTasks = tasks.filter(task => {
    if (!filterAssignee) return true;
    return task.assignees?.includes(filterAssignee) || task.assignee === filterAssignee;
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Grouping & Sorting
  const todayTasks = filteredTasks
    .filter(t => t.date === todayStr)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });

  const upcomingTasks = filteredTasks
    .filter(t => t.date > todayStr)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });

  const pastTasks = filteredTasks
    .filter(t => t.date < todayStr)
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) return b.time.localeCompare(a.time);
      if (a.time) return 1;
      if (b.time) return -1;
      return 0;
    });

  const getTasksForDay = (day: Date) => {
    return filteredTasks
      .filter(task => isSameDay(new Date(task.date), day))
      .sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ตารางงาน (Tasks)</h1>
          <p className="text-slate-500">จัดการและติดตามภารกิจทั้งหมด</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="bg-white p-1 rounded-lg flex items-center border border-slate-200 shadow-sm">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition ${viewMode === 'calendar' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">ปฏิทิน</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">รายการ</span>
            </button>
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditingTask(null); setIsFormOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" />
              เพิ่มงาน
            </button>
          )}
        </div>
      </header>

      {/* Custom Staff Selector (Direct Pill buttons instead of dropdown) */}
      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center w-full">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1">เลือกผู้รับผิดชอบ:</span>
          <button
            onClick={() => setFilterAssignee('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition duration-150 active:scale-95 ${
              !filterAssignee
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ทั้งหมด
          </button>
          {STAFF_MEMBERS.map((staffName) => {
            const theme = getStaffTheme(staffName);
            const isSelected = filterAssignee === staffName;
            return (
              <button
                key={staffName}
                onClick={() => setFilterAssignee(isSelected ? '' : staffName)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all duration-150 active:scale-95 flex items-center gap-1.5 ${
                  isSelected
                    ? `${theme.bg} ${theme.badge} border-current ring-1 ring-offset-1 ring-indigo-500/30 shadow-xs scale-[1.02]`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                {staffName}
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-6">
          {filteredTasks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
              <Clock className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400 font-semibold">ไม่มีภารกิจในระบบ</p>
            </div>
          ) : (
            <>
              {/* Unified Active Tasks (Today & Upcoming) */}
              {(todayTasks.length > 0 || upcomingTasks.length > 0) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                    <h2 className="text-lg font-bold text-slate-800">
                      ภารกิจวันนี้และเร็วๆ นี้ ({todayTasks.length + upcomingTasks.length})
                    </h2>
                  </div>
                  
                  {/* Desktop Table */}
                  <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-slate-400 text-left border-b border-slate-100">
                          <tr>
                            <th className="pb-3 font-medium">ชื่องาน</th>
                            <th className="pb-3 font-medium">วันที่ / เวลา</th>
                            <th className="pb-3 font-medium">ผู้รับผิดชอบ</th>
                            <th className="pb-3 font-medium">ผู้บันทึก</th>
                            {canEdit && <th className="pb-3 font-medium text-right">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {[...todayTasks, ...upcomingTasks].map(task => (
                            <tr key={task.id} className="hover:bg-slate-50/80 transition border-l-4 border-l-transparent">
                              <td className="p-4">
                                <p className="font-bold text-slate-900 flex items-center gap-2">
                                  {task.title}
                                  {task.attachmentUrl && (
                                    <a
                                      href={task.attachmentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-600 hover:text-indigo-800"
                                      title="ดูเอกสารแนบ"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Paperclip className="w-4 h-4" />
                                    </a>
                                  )}
                                </p>
                                <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  {dateBadge(task.date)}
                                  {task.time && <div className="text-xs text-slate-400 flex items-center gap-1 font-semibold"><Clock className="w-3 h-3 text-slate-400" /> {task.time} น.</div>}
                                </div>
                              </td>
                              <td className="p-4 text-sm font-medium">
                                <div className="flex flex-wrap gap-1">
                                  {task.assignees && task.assignees.length > 0 ? (
                                    task.assignees.map(name => {
                                      const t = getStaffTheme(name);
                                      return (
                                        <span key={name} className={`px-2 py-0.5 rounded-md text-xs font-bold border ${t.badge}`}>
                                          {name}
                                        </span>
                                      );
                                    })
                                  ) : task.assignee ? (
                                    (() => {
                                      const t = getStaffTheme(task.assignee);
                                      return (
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${t.badge}`}>
                                          {task.assignee}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-sm text-slate-500">
                                {task.createdBy || 'ไม่ระบุ'}
                              </td>
                              {canEdit && (
                                <td className="p-4 whitespace-nowrap text-right space-x-2">
                                  <button
                                    onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(task.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Cards */}
                  <div className="block md:hidden space-y-3">
                    {[...todayTasks, ...upcomingTasks].map(task => {
                      const primaryAssignee = task.assignees?.[0] || task.assignee;
                      const theme = getStaffTheme(primaryAssignee);
                      return (
                        <div 
                          key={task.id} 
                          className={`bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3 border-l-4 ${theme.borderLeft}`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <h3 className="font-bold text-slate-900 flex items-center flex-wrap gap-1.5 text-base leading-snug">
                                {task.title}
                                {task.attachmentUrl && (
                                  <a
                                    href={task.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded-lg transition"
                                    title="ดูเอกสารแนบ"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </h3>
                              {task.description && (
                                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{task.description}</p>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(task.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {dateBadge(task.date)}
                            {task.time && (
                              <div className="text-[10px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1 font-bold">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {task.time} น.
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <div>
                              <span className="font-semibold text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">ผู้รับผิดชอบ</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {task.assignees && task.assignees.length > 0 ? (
                                  task.assignees.map(name => {
                                    const t = getStaffTheme(name);
                                    return (
                                      <span key={name} className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${t.badge}`}>
                                        {name}
                                      </span>
                                    );
                                  })
                                ) : task.assignee ? (
                                  (() => {
                                    const t = getStaffTheme(task.assignee);
                                    return (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${t.badge}`}>
                                        {task.assignee}
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">ผู้บันทึก</span>
                              <p className="font-medium text-slate-700 truncate">
                                {task.createdBy || '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Past Tasks (Collapsible) */}
              {pastTasks.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setShowPastTasks(!showPastTasks)}
                    className="w-full py-3 px-5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl transition flex items-center justify-between text-sm shadow-xs active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      ภารกิจที่ผ่านมาแล้ว ({pastTasks.length} รายการ)
                    </span>
                    <span className="text-indigo-600 hover:text-indigo-700 text-xs sm:text-sm">
                      {showPastTasks ? 'ซ่อนภารกิจที่ผ่านมาแล้ว' : 'แสดงภารกิจที่ผ่านมาแล้ว'}
                    </span>
                  </button>
                  
                  {showPastTasks && (
                    <div className="space-y-4">
                      {/* Desktop Table */}
                      <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6 opacity-75">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-slate-400 text-left border-b border-slate-100">
                              <tr>
                                <th className="pb-3 font-medium">ชื่องาน</th>
                                <th className="pb-3 font-medium">วันที่ / เวลา</th>
                                <th className="pb-3 font-medium">ผู้รับผิดชอบ</th>
                                <th className="pb-3 font-medium text-center">ความสำคัญ</th>
                                {canEdit && <th className="pb-3 font-medium text-right">จัดการ</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {pastTasks.map(task => (
                                <tr key={task.id} className="hover:bg-slate-50/80 transition border-l-4 border-l-transparent">
                                  <td className="p-4">
                                    <p className="font-medium text-slate-700 flex items-center gap-2">
                                      {task.title}
                                      {task.attachmentUrl && (
                                        <a
                                          href={task.attachmentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-800"
                                          title="ดูเอกสารแนบ"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Paperclip className="w-4 h-4" />
                                        </a>
                                      )}
                                    </p>
                                    <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
                                  </td>
                                  <td className="p-4 whitespace-nowrap">
                                    <div className="space-y-1">
                                      {dateBadge(task.date)}
                                      {task.time && <div className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {task.time} น.</div>}
                                    </div>
                                  </td>
                                  <td className="p-4 text-sm font-medium">
                                    <div className="flex flex-wrap gap-1">
                                      {task.assignees && task.assignees.length > 0 ? (
                                        task.assignees.map(name => {
                                          const t = getStaffTheme(name);
                                          return (
                                            <span key={name} className={`px-2 py-0.5 rounded-md text-xs font-bold border ${t.badge}`}>
                                              {name}
                                            </span>
                                          );
                                        })
                                      ) : task.assignee ? (
                                        (() => {
                                          const t = getStaffTheme(task.assignee);
                                          return (
                                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${t.badge}`}>
                                              {task.assignee}
                                            </span>
                                          );
                                        })()
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 whitespace-nowrap text-center">
                                    {priorityBadge(task.priority)}
                                  </td>
                                  {canEdit && (
                                    <td className="p-4 whitespace-nowrap text-right space-x-2">
                                      <button
                                        onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(task.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile Cards */}
                      <div className="block md:hidden space-y-3 opacity-80">
                        {pastTasks.map(task => {
                          const primaryAssignee = task.assignees?.[0] || task.assignee;
                          const theme = getStaffTheme(primaryAssignee);
                          return (
                            <div 
                              key={task.id} 
                              className={`bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3 border-l-4 ${theme.borderLeft}`}
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                  <h3 className="font-semibold text-slate-800 flex items-center flex-wrap gap-1.5 text-base leading-snug">
                                    {task.title}
                                    {task.attachmentUrl && (
                                      <a
                                        href={task.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded-lg transition"
                                        title="ดูเอกสารแนบ"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Paperclip className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </h3>
                                  {task.description && (
                                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{task.description}</p>
                                  )}
                                </div>
                                {canEdit && (
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(task.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {dateBadge(task.date)}
                                {task.time && (
                                  <div className="text-[10px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1 font-semibold">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {task.time} น.
                                  </div>
                                )}
                                {priorityBadge(task.priority)}
                              </div>
                              <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <span className="font-semibold text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">ผู้รับผิดชอบ</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {task.assignees && task.assignees.length > 0 ? (
                                    task.assignees.map(name => {
                                      const t = getStaffTheme(name);
                                      return (
                                        <span key={name} className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${t.badge}`}>
                                          {name}
                                        </span>
                                      );
                                    })
                                  ) : task.assignee ? (
                                    (() => {
                                      const t = getStaffTheme(task.assignee);
                                      return (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${t.badge}`}>
                                          {task.assignee}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: th })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-slate-200 bg-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-slate-200 bg-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-7 mb-2 sm:mb-4">
              {weekDays.map((day, idx) => (
                <div key={idx} className="text-center text-xs sm:text-sm font-semibold text-slate-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-4">
              {calendarDays.map((day, dayIdx) => {
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                const holidayKey = format(day, 'MM-dd');
                const holidayName = THAI_HOLIDAYS[holidayKey];

                return (
                  <div
                    key={dayIdx}
                    onClick={() => setSelectedDayDetails(day)}
                    className={`min-h-[80px] sm:min-h-[120px] rounded-lg sm:rounded-2xl border p-1 sm:p-2 flex flex-col transition-all overflow-hidden cursor-pointer hover:shadow-md ${
                      isToday
                        ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm scale-[1.01]'
                        : !isCurrentMonth
                        ? 'bg-slate-50/50 border-transparent'
                        : 'bg-white border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`text-xs sm:text-sm font-bold w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-indigo-600 text-white shadow-sm scale-105'
                            : isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                    {holidayName && (
                      <span className="text-[8px] sm:text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded-md truncate max-w-full block mb-1.5 animate-pulse select-none text-center" title={holidayName}>
                        🎉 {holidayName}
                      </span>
                    )}
                    <div className="flex-1 overflow-y-auto space-y-1 sm:space-y-1.5 scrollbar-hide">
                      {dayTasks.map(task => {
                        const primaryAssignee = task.assignees?.[0] || task.assignee;
                        const theme = getStaffTheme(primaryAssignee);
                        return (
                          <div
                            key={task.id}
                            onClick={(e) => { e.stopPropagation(); if (canEdit) { setEditingTask(task); setIsFormOpen(true); } }}
                            className={`text-[10px] sm:text-xs px-1 sm:px-2 py-1 sm:py-1.5 rounded sm:rounded-lg cursor-pointer transition border border-l-4 ${theme.borderLeft} flex flex-col gap-0.5 relative group ${
                              task.priority === 'high'
                                ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                                : task.priority === 'medium'
                                ? 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100'
                            }`}
                            title={task.title}
                          >
                            <span className="font-semibold truncate leading-tight sm:leading-normal pr-4">{task.title}</span>
                            {task.attachmentUrl && (
                              <div className="absolute top-1 right-1 opacity-60">
                                <Paperclip className="w-2.5 h-2.5" />
                              </div>
                            )}
                            {task.time && <span className="text-[8px] sm:text-[10px] opacity-75 flex items-center gap-0.5"><Clock className="w-2 sm:w-2.5 h-2 sm:h-2.5" /> {task.time}</span>}
                            {(task.assignees?.length || task.assignee) && <span className="text-[8px] sm:text-[10px] opacity-75 mt-0.5 border-t pt-0.5 border-black/10 truncate">{task.assignees?.length ? task.assignees.join(', ') : task.assignee}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <TaskForm 
          task={editingTask} 
          user={user} 
          onClose={() => setIsFormOpen(false)} 
          onDelete={handleDelete}
        />
      )}

      {/* Day Details Modal */}
      {selectedDayDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDayDetails(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {format(selectedDayDetails, 'dd MMMM yyyy', { locale: th })}
                </h2>
                {THAI_HOLIDAYS[format(selectedDayDetails, 'MM-dd')] && (
                  <p className="text-rose-500 font-semibold text-sm mt-1">
                    🎉 {THAI_HOLIDAYS[format(selectedDayDetails, 'MM-dd')]}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setSelectedDayDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50">
              {getTasksForDay(selectedDayDetails).length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-medium">ไม่มีภารกิจในวันนี้</div>
              ) : (
                getTasksForDay(selectedDayDetails).map(task => {
                  const primaryAssignee = task.assignees?.[0] || task.assignee;
                  const theme = getStaffTheme(primaryAssignee);
                  return (
                    <div 
                      key={task.id}
                      onClick={() => {
                        if (canEdit) {
                          setSelectedDayDetails(null);
                          setEditingTask(task);
                          setIsFormOpen(true);
                        }
                      }}
                      className={`p-4 rounded-2xl bg-white border border-slate-200 shadow-sm transition flex flex-col gap-2 ${canEdit ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <h4 className="font-bold text-slate-800 text-base">{task.title}</h4>
                        {priorityBadge(task.priority)}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs items-center">
                        {statusBadge(task.status)}
                        {task.time && (
                          <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {task.time}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{task.description}</p>
                      <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${theme.dot}`} />
                            <span className="text-xs font-bold text-slate-700">
                               {task.assignees?.length ? task.assignees.join(', ') : task.assignee}
                            </span>
                         </div>
                         {task.attachmentUrl && (
                           <a 
                             href={task.attachmentUrl} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             onClick={(e) => e.stopPropagation()}
                             className="text-indigo-600 flex items-center gap-1 text-xs font-bold bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition"
                           >
                             <Paperclip className="w-3.5 h-3.5" /> File
                           </a>
                         )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {canEdit && (
              <div className="p-4 border-t border-slate-100 bg-white">
                <button
                  onClick={() => {
                    setSelectedDayDetails(null);
                    setEditingTask({ date: format(selectedDayDetails, 'yyyy-MM-dd') } as any);
                    setIsFormOpen(true);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  เพิ่มภารกิจใหม่ในวันนี้
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
