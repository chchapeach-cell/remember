import { Role } from '../types';
import { ShieldAlert, UserSquare2, Users } from 'lucide-react';

export default function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">ยินดีต้อนรับสู่ระบบ</h2>
        <p className="text-slate-500 mb-8">กรุณาเลือกบทบาทของคุณในระบบเพื่อเริ่มต้นใช้งาน</p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <button 
            onClick={() => onSelect('executive')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-200 rounded-3xl transition text-center group shadow-sm hover:shadow-md"
          >
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">ผู้บริหาร</h3>
            <p className="text-sm text-slate-500">ดูภาพรวม Dashboard แบบเรียลไทม์ และสรุปรายงาน</p>
          </button>

          <button 
            onClick={() => onSelect('staff')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-green-50 border-2 border-transparent hover:border-green-200 rounded-3xl transition text-center group shadow-sm hover:shadow-md"
          >
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UserSquare2 className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">เจ้าหน้าที่</h3>
            <p className="text-sm text-slate-500">เพิ่ม แก้ไข อัปเดตสถานะงาน และตั้งค่าการแจ้งเตือน</p>
          </button>

          <button 
            onClick={() => onSelect('general')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-orange-50 border-2 border-transparent hover:border-orange-200 rounded-3xl transition text-center group shadow-sm hover:shadow-md"
          >
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">บุคลากรทั่วไป</h3>
            <p className="text-sm text-slate-500">ดูตารางงานทั่วไป และติดตามความคืบหน้า</p>
          </button>
        </div>
      </div>
    </div>
  );
}
