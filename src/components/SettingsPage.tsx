import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsPage({ user }: { user: User | null }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'line_oa');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setToken(docSnap.data().token || '');
        }
      } catch (error) {
        console.error("Error fetching settings", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (user.role !== 'staff' && user.role !== 'executive')) return;
    
    setSaving(true);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'settings', 'line_oa'), {
        token: token,
        updatedBy: user.uid,
        updatedAt: Date.now()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving settings", error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">กำลังโหลดข้อมูล...</div>;
  }

  if (!user || (user.role !== 'staff' && user.role !== 'executive')) {
    return <div className="p-8 text-center text-red-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          ตั้งค่าระบบ
        </h1>
        <p className="text-slate-500 mt-1">จัดการการเชื่อมต่อและการแจ้งเตือนต่างๆ ของระบบ</p>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">การเชื่อมต่อ LINE OA (การแจ้งเตือน)</h2>
          <p className="text-sm text-slate-500">ระบุ Channel Access Token ของ LINE Official Account เพื่อให้ระบบสามารถส่งข้อความแจ้งเตือนอัตโนมัติ</p>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">LINE Channel Access Token (Long-lived)</label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition font-mono text-sm resize-none h-32"
            />
            <p className="text-xs text-slate-500 mt-2">
              หมายเหตุ: หากไม่มีการตั้งค่า ระบบจะข้ามการส่งแจ้งเตือนโดยไม่เกิดข้อผิดพลาด
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
            {success && (
              <span className="text-green-600 text-sm flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                บันทึกสำเร็จ
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
