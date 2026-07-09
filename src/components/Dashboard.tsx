import { useEffect, useState } from 'react';
import { User, Task } from '../types';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981']; // blue (pending), orange (in_progress), green (completed)
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };

export default function Dashboard({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskData);
    });
    return () => unsubscribe();
  }, []);

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    total: tasks.length
  };

  const pieData = [
    { name: 'รอดำเนินการ', value: stats.pending, color: COLORS[0] },
    { name: 'กำลังดำเนินการ', value: stats.inProgress, color: COLORS[1] },
    { name: 'เสร็จสิ้น', value: stats.completed, color: COLORS[2] },
  ];

  // Group by priority
  const priorityData = [
    { name: 'สูง', value: tasks.filter(t => t.priority === 'high').length, fill: PRIORITY_COLORS.high },
    { name: 'ปานกลาง', value: tasks.filter(t => t.priority === 'medium').length, fill: PRIORITY_COLORS.medium },
    { name: 'ต่ำ', value: tasks.filter(t => t.priority === 'low').length, fill: PRIORITY_COLORS.low },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">ภาพรวมระบบ (Dashboard)</h1>
        <p className="text-slate-500">ติดตามความคืบหน้าของภารกิจทั้งหมดแบบเรียลไทม์</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <span className="text-slate-500 text-sm font-medium mb-2">ภารกิจทั้งหมด</span>
          <span className="text-3xl font-bold text-slate-900">{stats.total}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-slate-500 text-sm font-medium">รอดำเนินการ</span>
          </div>
          <span className="text-3xl font-bold text-blue-600">{stats.pending}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-slate-500 text-sm font-medium">กำลังดำเนินการ</span>
          </div>
          <span className="text-3xl font-bold text-orange-600">{stats.inProgress}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-slate-500 text-sm font-medium">เสร็จสิ้น</span>
          </div>
          <span className="text-3xl font-bold text-green-600">{stats.completed}</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">สถานะภารกิจ</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">ระดับความสำคัญ</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
