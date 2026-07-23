import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { Task, User } from '../types';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';

export default function NotificationDropdown({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tasks'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Filter tasks for this user that are today or in the future
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const userTasks = taskData.filter(t => {
        const isAssignedToUser = t.assignees?.includes(user.displayName) || t.assignee === user.displayName;
        return isAssignedToUser && t.status !== 'completed' && t.date >= todayStr;
      });
      
      setTasks(userTasks);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const todayTasks = tasks.filter(t => t.date === format(new Date(), 'yyyy-MM-dd'));
  const upcomingTasks = tasks.filter(t => t.date > format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-indigo-100 hover:text-white bg-indigo-800/50 hover:bg-indigo-700 rounded-full transition"
        title="การแจ้งเตือนงานของคุณ"
      >
        <Bell className="w-5 h-5" />
        {tasks.length > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-indigo-900">
            {tasks.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
          <div className="bg-indigo-50 p-4 border-b border-indigo-100">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              ภารกิจของคุณ
            </h3>
            <p className="text-xs text-indigo-600 mt-1">รายการงานที่ต้องดำเนินการ</p>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm">ยอดเยี่ยม! คุณไม่มีภารกิจค้างอยู่</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayTasks.length > 0 && (
                  <div className="p-2 bg-rose-50/50">
                    <div className="px-3 py-2 text-xs font-bold text-rose-600 uppercase tracking-wider">
                      วันนี้ ({todayTasks.length})
                    </div>
                    {todayTasks.map(task => (
                      <div key={task.id} className="p-3 hover:bg-white rounded-xl transition cursor-default">
                        <p className="text-sm font-bold text-slate-800">{task.title}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          {task.time && <span className="flex items-center gap-1 text-rose-600 font-semibold bg-rose-100/50 px-1.5 py-0.5 rounded"><Clock className="w-3 h-3" /> {task.time}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(task.date), 'd MMM', { locale: th })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {upcomingTasks.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      เร็วๆ นี้ ({upcomingTasks.length})
                    </div>
                    {upcomingTasks.map(task => (
                      <div key={task.id} className="p-3 hover:bg-slate-50 rounded-xl transition cursor-default">
                        <p className="text-sm font-semibold text-slate-700">{task.title}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          {task.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.time}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(task.date), 'd MMM', { locale: th })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
