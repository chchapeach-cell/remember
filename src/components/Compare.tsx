import React, { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { db, storage } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User as UserIcon, Paperclip, CheckCircle2, AlertCircle, Sun, Sunset, Image as ImageIcon, Loader2, X, Trash2 } from 'lucide-react';
import { getStaffTheme } from '../utils/staffColors';

const STAFF_MEMBERS = [
  'นางสาววรินทร ปัดกอง',
  'นายสากล ชนะบูรณ์',
  'นายจักรวาล เขียวดีเจริญกุล',
  'นางสาวญาสุมินทร์ นนทมาตร'
];

export default function Compare({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  const isImageUrl = (url?: string) => {
    if (!url) return false;
    return url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)/) !== null || url.includes('image') || url.includes('googleusercontent');
  };

  const handleUploadImage = async (taskId: string, file: File) => {
    setUploadingTaskId(taskId);
    try {
      const fileRef = ref(storage, `task_images/${taskId}_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      await updateDoc(doc(db, 'tasks', taskId), {
        imageUrl: downloadUrl
      });
    } catch (error) {
      console.error("Error uploading task image:", error);
      alert('ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploadingTaskId(null);
    }
  };

  const handleRemoveImage = async (taskId: string) => {
    if (window.confirm('คุณต้องการลบรูปภาพนี้ใช่หรือไม่?')) {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          imageUrl: ''
        });
      } catch (error) {
        console.error("Error deleting task image:", error);
        alert('เกิดข้อผิดพลาดในการลบรูปภาพ');
      }
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('time', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskData);
    });
    return () => unsubscribe();
  }, []);

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  // Filter tasks for the selected date
  const tasksOnSelectedDate = tasks.filter(task => {
    const parts = task.date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return isSameDay(new Date(year, month, day), selectedDate);
    }
    return isSameDay(new Date(task.date), selectedDate);
  });

  const getTasksForStaff = (staffName: string) => {
    return tasksOnSelectedDate.filter(task => 
      task.assignees?.includes(staffName) || task.assignee === staffName
    ).sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  };

  const statusBadge = (status: Task['status']) => {
    const config = {
      pending: { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'รอดำเนินการ' },
      in_progress: { color: 'bg-orange-50 text-orange-600 border-orange-200', label: 'กำลังดำเนินการ' },
      completed: { color: 'bg-green-50 text-green-600 border-green-200', label: 'เสร็จสิ้น' },
    };
    const current = config[status] || config.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${current.color}`}>
        {current.label}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เปรียบเทียบตารางงาน</h1>
          <p className="text-slate-500">เปรียบเทียบภารกิจของบุคลากรแต่ละท่านแบบเคียงข้างกัน (Side-by-Side)</p>
        </div>
        
        {/* Date Selector controls */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={handlePrevDay}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-600"
            title="วันก่อนหน้า"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 px-3">
            <CalendarIcon className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-slate-800 text-sm">
              {format(selectedDate, 'eee dd MMM yyyy', { locale: th })}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1.5 rounded-xl transition"
            >
              วันนี้
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-600"
              title="วันถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Grid comparing the 4 staff members side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STAFF_MEMBERS.map((staffName) => {
          const staffTasks = getTasksForStaff(staffName);
          const theme = getStaffTheme(staffName);

          const morningTasks = staffTasks.filter(task => {
            if (!task.time) return false;
            const hour = parseInt(task.time.split(':')[0], 10);
            return !isNaN(hour) && hour < 12;
          });

          const afternoonTasks = staffTasks.filter(task => {
            if (!task.time) return false;
            const hour = parseInt(task.time.split(':')[0], 10);
            return !isNaN(hour) && hour >= 12;
          });

          const unspecifiedTasks = staffTasks.filter(task => !task.time);

          const renderTask = (task: Task) => (
            <div 
              key={task.id} 
              className={`bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3 hover:shadow-xs transition duration-200 group relative border-l-4 ${theme.borderLeft}`}
            >
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm leading-snug flex items-center flex-wrap gap-1">
                  {task.title}
                  {task.attachmentUrl && (
                    <a
                      href={task.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 p-0.5 bg-indigo-50 rounded"
                      title="ดูเอกสารแนบ"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Paperclip className="w-3 h-3" />
                    </a>
                  )}
                </h4>
                {task.description && (
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-line">
                    {task.description}
                  </p>
                )}
              </div>

              {/* IMAGE DISPLAY / UPLOADER */}
              {task.imageUrl || (task.attachmentUrl && isImageUrl(task.attachmentUrl)) ? (
                <div className="relative mt-2 rounded-xl overflow-hidden border border-slate-200/60 bg-white group/img max-h-48 shadow-2xs">
                  <img
                    src={task.imageUrl || task.attachmentUrl}
                    alt={task.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-32 object-cover hover:scale-105 transition duration-300 cursor-zoom-in"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(task.imageUrl || task.attachmentUrl, '_blank');
                    }}
                  />
                  {user?.role === 'staff' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(task.id);
                      }}
                      className="absolute top-1.5 right-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-full p-1.5 transition shadow opacity-0 group-hover/img:opacity-100 duration-150"
                      title="ลบรูปภาพ"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : uploadingTaskId === task.id ? (
                <div className="mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-50/50 border border-dashed border-indigo-200 rounded-xl text-xs font-semibold text-indigo-600">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  กำลังอัปโหลดรูปภาพ...
                </div>
              ) : user?.role === 'staff' ? (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <label className="flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 hover:text-indigo-600 transition text-[11px] font-bold text-slate-500 bg-white">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    เพิ่มรูปภาพภารกิจ
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadImage(task.id, e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                {task.time ? (
                  <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {task.time} น.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">ไม่ระบุเวลา</span>
                )}
                {statusBadge(task.status)}
              </div>

              {/* Display Creator (ผู้บันทึก) as requested */}
              <div className="bg-white/80 rounded-xl px-2.5 py-1.5 border border-slate-100 flex flex-col gap-0.5 text-[9px]">
                <span className="text-slate-400 font-bold uppercase tracking-wider">ผู้บันทึก</span>
                <span className="font-semibold text-slate-700 truncate">
                  {task.createdBy || 'ระบบอัตโนมัติ'}
                </span>
              </div>
            </div>
          );

          return (
            <div 
              key={staffName} 
              className={`bg-white rounded-3xl border-2 ${theme.border} overflow-hidden shadow-xs flex flex-col min-h-[480px] transition-all duration-300 hover:shadow-md hover:${theme.shadow}`}
            >
              {/* Card Header for each person */}
              <div className={`p-5 border-b ${theme.borderHeader} ${theme.bg} flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-2xl bg-white ${theme.text} flex items-center justify-center font-bold flex-shrink-0 shadow-sm border ${theme.border}`}>
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-slate-800 text-sm truncate" title={staffName}>
                    {staffName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${theme.badge}`}>
                      {staffTasks.length} ภารกิจ
                    </span>
                    {morningTasks.length > 0 && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50/70 border border-amber-100 px-1 py-0.2 rounded">
                        เช้า {morningTasks.length}
                      </span>
                    )}
                    {afternoonTasks.length > 0 && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50/70 border border-indigo-100 px-1 py-0.2 rounded">
                        บ่าย {afternoonTasks.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasks list under each person */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[550px]">
                {staffTasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-2xl min-h-[200px]">
                    <Clock className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400 font-medium">ไม่มีภารกิจในวันนี้</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Morning Section */}
                    {morningTasks.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full w-fit uppercase tracking-wide">
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          ช่วงเช้า (ก่อน 12:00 น.)
                        </div>
                        <div className="space-y-3 pl-1.5 border-l-2 border-amber-200/80">
                          {morningTasks.map(renderTask)}
                        </div>
                      </div>
                    )}

                    {/* Afternoon Section */}
                    {afternoonTasks.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full w-fit uppercase tracking-wide">
                          <Sunset className="w-3.5 h-3.5 text-indigo-500" />
                          ช่วงบ่าย (หลัง 12:00 น.)
                        </div>
                        <div className="space-y-3 pl-1.5 border-l-2 border-indigo-200/80">
                          {afternoonTasks.map(renderTask)}
                        </div>
                      </div>
                    )}

                    {/* Unspecified Section */}
                    {unspecifiedTasks.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full w-fit uppercase tracking-wide">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          ไม่ระบุเวลา
                        </div>
                        <div className="space-y-3 pl-1.5 border-l-2 border-slate-200">
                          {unspecifiedTasks.map(renderTask)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
