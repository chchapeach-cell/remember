import { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { FileText, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Report({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskData);
    });
    return () => unsubscribe();
  }, []);

  // Filter tasks by selected month
  const filteredTasks = tasks.filter(task => {
    return task.date.startsWith(selectedMonth);
  });

  const stats = {
    total: filteredTasks.length,
    completed: filteredTasks.filter(t => t.status === 'completed').length,
    pending: filteredTasks.filter(t => t.status === 'pending').length,
    inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
  };

  const statusData = [
    { name: 'เสร็จสิ้น', value: stats.completed, fill: '#10b981' },
    { name: 'กำลังดำเนินการ', value: stats.inProgress, fill: '#f59e0b' },
    { name: 'รอดำเนินการ', value: stats.pending, fill: '#3b82f6' },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">รายงานสรุปผล</h1>
          <p className="text-slate-500">สรุปผลการดำเนินงานประจำเดือน</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm text-slate-700"
            />
            <Calendar className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button
            onClick={handlePrint}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            ส่งออก / พิมพ์
          </button>
        </div>
      </header>

      {/* Report Header (Visible in print) */}
      <div className="hidden print:block text-center mb-8 pb-4 border-b-2 border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">รายงานสรุปผลการดำเนินงาน</h1>
        <p className="text-lg text-slate-600">
          ประจำเดือน {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: th })}
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col">
          <span className="text-indigo-600 text-sm font-medium mb-1">งานทั้งหมดในเดือนนี้</span>
          <span className="text-3xl font-bold text-indigo-900">{stats.total}</span>
        </div>
        <div className="bg-green-50 p-6 rounded-3xl border border-green-100 flex flex-col">
          <span className="text-green-600 text-sm font-medium mb-1">งานที่เสร็จสิ้น</span>
          <span className="text-3xl font-bold text-green-900">{stats.completed}</span>
        </div>
        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex flex-col">
          <span className="text-orange-600 text-sm font-medium mb-1">กำลังดำเนินการ</span>
          <span className="text-3xl font-bold text-orange-900">{stats.inProgress}</span>
        </div>
        <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200 flex flex-col">
          <span className="text-slate-600 text-sm font-medium mb-1">รอดำเนินการ</span>
          <span className="text-3xl font-bold text-slate-900">{stats.pending}</span>
        </div>
      </div>

      {filteredTasks.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6 print:grid-cols-1">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 print:shadow-none print:border-none">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              สรุปสถานะภารกิจ
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {/* Colors handled in data */}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">รายการภารกิจในเดือน</h2>
            </div>
            <div className="max-h-[300px] overflow-y-auto print:max-h-full print:overflow-visible">
              <ul className="divide-y divide-slate-50">
                {filteredTasks.map(task => (
                  <li key={task.id} className="p-4 flex items-start gap-4">
                    <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      task.status === 'completed' ? 'bg-green-500' :
                      task.status === 'in_progress' ? 'bg-orange-500' : 'bg-slate-400'
                    }`} />
                    <div>
                      <p className="font-medium text-slate-800">{task.title}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(task.date), 'dd MMM yyyy', { locale: th })} • 
                        ความสำคัญ: {task.priority === 'high' ? 'สูง' : task.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800">ไม่มีข้อมูลภารกิจ</h3>
          <p className="text-slate-500">ไม่พบภารกิจที่บันทึกไว้ในเดือนที่เลือก</p>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { background-color: white; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
