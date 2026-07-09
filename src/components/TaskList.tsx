import { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { Plus, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, LayoutList, Calendar as CalendarIcon, Paperclip } from 'lucide-react';
import TaskForm from './TaskForm';

export default function TaskList({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterAssignee, setFilterAssignee] = useState<string>('');

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

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xs ${style.bg}`}>
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        <span className="opacity-90">{style.label}</span>
        <span className="opacity-40 font-normal">|</span>
        <span>{formattedDate}</span>
      </span>
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

  const sortedFilteredTasks = [...filteredTasks].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ตารางงาน (Tasks)</h1>
          <p className="text-slate-500">จัดการและติดตามภารกิจทั้งหมด</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">-- ผู้รับผิดชอบทั้งหมด --</option>
            <option value="นางสาววรินทร ปัดกอง">นางสาววรินทร ปัดกอง</option>
            <option value="นายสากล ชนะบูรณ์">นายสากล ชนะบูรณ์</option>
            <option value="นายจักรวาล เขียวดีเจริญกุล">นายจักรวาล เขียวดีเจริญกุล</option>
            <option value="นางสาวญาสุมินทร์ นนทมาตร">นางสาวญาสุมินทร์ นนทมาตร</option>
          </select>
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
              เพิ่มภารกิจใหม่
            </button>
          )}
        </div>
      </header>

      {viewMode === 'list' ? (
        <div className="space-y-4">
          {/* Desktop view (md and up) */}
          <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-left border-b border-slate-100">
                  <tr>
                    <th className="pb-3 font-medium">ชื่องาน</th>
                    <th className="pb-3 font-medium">วันที่</th>
                    <th className="pb-3 font-medium">ผู้รับผิดชอบ</th>
                    <th className="pb-3 font-medium text-center">ความสำคัญ</th>
                    <th className="pb-3 font-medium">สถานะ</th>
                    {canEdit && <th className="pb-3 font-medium text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedFilteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">ไม่มีข้อมูลภารกิจ</td>
                    </tr>
                  ) : sortedFilteredTasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <p className="font-medium text-slate-900 flex items-center gap-2">
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
                        {dateBadge(task.date)}
                        {task.time && <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {task.time} น.</div>}
                      </td>
                      <td className="p-4 whitespace-nowrap text-sm text-slate-600">
                        {task.assignees?.length ? task.assignees.join(', ') : (task.assignee ? task.assignee : <span className="text-slate-400">-</span>)}
                      </td>
                      <td className="p-4 whitespace-nowrap text-center">
                        {priorityBadge(task.priority)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {canEdit ? (
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                            className={`text-sm border-0 rounded-full px-3 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 ${
                              task.status === 'pending' ? 'bg-slate-100 text-slate-700' :
                              task.status === 'in_progress' ? 'bg-orange-50 text-orange-700' :
                              'bg-green-50 text-green-700'
                            }`}
                          >
                            <option value="pending">รอดำเนินการ</option>
                            <option value="in_progress">กำลังดำเนินการ</option>
                            <option value="completed">เสร็จสิ้น</option>
                          </select>
                        ) : (
                          statusBadge(task.status)
                        )}
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

          {/* Mobile view (sm and down) */}
          <div className="block md:hidden space-y-4">
            {sortedFilteredTasks.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center text-slate-500 border border-slate-200 shadow-sm">
                ไม่มีข้อมูลภารกิจ
              </div>
            ) : (
              sortedFilteredTasks.map(task => (
                <div key={task.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                  {/* Top segment: Title & Actions */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900 flex items-center flex-wrap gap-2 text-base leading-snug">
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Badges/Meta line: Date, Time, Priority */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="flex-shrink-0">
                      {dateBadge(task.date)}
                    </div>
                    {task.time && (
                      <div className="text-xs text-slate-500 bg-white px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {task.time} น.
                      </div>
                    )}
                    <div className="flex-shrink-0">
                      {priorityBadge(task.priority)}
                    </div>
                  </div>

                  {/* Assignee & Status line */}
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-400 block mb-1">ผู้รับผิดชอบ:</span>
                      <p className="font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        {task.assignees?.length ? task.assignees.join(', ') : (task.assignee ? task.assignee : '-')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-slate-400">สถานะ:</span>
                      {canEdit ? (
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                          className={`text-xs font-bold border border-slate-200 rounded-full px-4 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition ${
                            task.status === 'pending' ? 'bg-slate-100 text-slate-700' :
                            task.status === 'in_progress' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            'bg-green-50 text-green-700 border-green-100'
                          }`}
                        >
                          <option value="pending">รอดำเนินการ</option>
                          <option value="in_progress">กำลังดำเนินการ</option>
                          <option value="completed">เสร็จสิ้น</option>
                        </select>
                      ) : (
                        statusBadge(task.status)
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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

                return (
                  <div
                    key={dayIdx}
                    className={`min-h-[80px] sm:min-h-[120px] rounded-lg sm:rounded-2xl border p-1 sm:p-2 flex flex-col transition-colors overflow-hidden ${
                      !isCurrentMonth ? 'bg-slate-50/50 border-transparent' : 'bg-white border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <span
                        className={`text-xs sm:text-sm font-medium w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-indigo-600 text-white'
                            : isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {canEdit && isCurrentMonth && (
                        <button
                          onClick={() => { setEditingTask({ date: format(day, 'yyyy-MM-dd') } as any); setIsFormOpen(true); }}
                          className="text-slate-300 hover:text-indigo-600 transition"
                          title="เพิ่มภารกิจในวันนี้"
                        >
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 sm:space-y-1.5 scrollbar-hide">
                      {dayTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => { if (canEdit) { setEditingTask(task); setIsFormOpen(true); } }}
                          className={`text-[10px] sm:text-xs px-1 sm:px-2 py-1 sm:py-1.5 rounded sm:rounded-lg cursor-pointer transition border flex flex-col gap-0.5 relative group ${
                            task.priority === 'high'
                              ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                              : task.priority === 'medium'
                              ? 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'
                              : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
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
                      ))}
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
    </div>
  );
}
