import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Settings, Save, CheckCircle2, UserPlus, Trash2, Shield, Users, Mail, AlertTriangle, Bell, Info } from 'lucide-react';
import axios from 'axios';

export default function SettingsPage({ user }: { user: User | null }) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'users'>('notifications');
  
  // Notification State
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loadingPush, setLoadingPush] = useState(true);
  const [savingPush, setSavingPush] = useState(false);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);

  // Allowed Users State
  const [allowedUsers, setAllowedUsers] = useState<{ email: string; role: Role; registered: boolean; uid?: string }[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'executive' | 'staff' | 'general'>('general');
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Register Service Worker and check push status
  useEffect(() => {
    const checkPush = async () => {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.register('/sw.js');
          const subscription = await registration.pushManager.getSubscription();
          setPushEnabled(!!subscription);
        }
      } catch (e) {
        console.error('Push error', e);
      } finally {
        setLoadingPush(false);
      }
    };
    checkPush();
  }, []);

  // Fetch allowed users and actual profiles in real-time
  useEffect(() => {
    if (activeTab !== 'users') return;
    
    setLoadingUsers(true);
    
    const unsubAllowed = onSnapshot(collection(db, 'allowed_emails'), (allowedSnap) => {
      const unsubUsers = onSnapshot(collection(db, 'users'), (usersSnap) => {
        const registeredMap = new Map<string, { uid: string; role: Role }>(); // email -> { uid, role }
        usersSnap.forEach(docSnap => {
          const u = docSnap.data();
          if (u.email) {
            registeredMap.set(u.email.toLowerCase().trim(), { uid: docSnap.id, role: u.role });
          }
        });
        
        const list: { email: string; role: Role; registered: boolean; uid?: string }[] = [];
        
        // Define hardcoded/always-allowed special admins
        const specials = ['tamrri@gmail.com', 'ch.chapeach@gmail.com'];
        specials.forEach(email => {
          const reg = registeredMap.get(email);
          list.push({
            email,
            role: 'executive',
            registered: !!reg,
            uid: reg?.uid
          });
        });
        
        allowedSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const email = docSnap.id.toLowerCase().trim();
          if (!specials.includes(email)) {
            const reg = registeredMap.get(email);
            list.push({
              email: data.email || email,
              role: (data.role || 'general') as Role,
              registered: !!reg,
              uid: reg?.uid
            });
          }
        });
        
        setAllowedUsers(list);
        setLoadingUsers(false);
      }, (err) => {
        console.error("Error reading users:", err);
        setLoadingUsers(false);
      });
      
      return () => unsubUsers();
    }, (err) => {
      console.error("Error reading allowed_emails:", err);
      setLoadingUsers(false);
    });
    
    return () => {
      unsubAllowed();
    };
  }, [activeTab]);

  const handleEnablePush = async () => {
    if (!user) return;
    setSavingPush(true);
    setPushSuccess(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('เบราว์เซอร์ของคุณไม่รองรับการแจ้งเตือน (Push Notifications)');
        setSavingPush(false);
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('คุณได้ปฏิเสธการแจ้งเตือน กรุณาเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์');
        setSavingPush(false);
        return;
      }
      
      // Get VAPID public key from backend
      const vapidRes = await axios.get('/api/vapidPublicKey');
      const applicationServerKey = urlBase64ToUint8Array(vapidRes.data);
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      
      // Save subscription to user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        pushSubscriptions: arrayUnion(JSON.stringify(subscription))
      });
      
      setPushEnabled(true);
      setPushSuccess('เปิดการแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว');
      setTimeout(() => setPushSuccess(null), 3500);
    } catch (error) {
      console.error("Error enabling push:", error);
      alert('เกิดข้อผิดพลาดในการเปิดแจ้งเตือน: ' + (error as any).message);
    } finally {
      setSavingPush(false);
    }
  };
  
  // Utility function for Web Push
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionSuccess(null);
    setUserActionError(null);
    
    const emailToTrim = newEmail.trim().toLowerCase();
    if (!emailToTrim) {
      setUserActionError('กรุณากรอกอีเมล');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToTrim)) {
      setUserActionError('กรุณากรอกรูปแบบอีเมลให้ถูกต้อง');
      return;
    }

    // Check if already in list
    const specials = ['tamrri@gmail.com', 'ch.chapeach@gmail.com'];
    if (specials.includes(emailToTrim)) {
      setUserActionError('อีเมลนี้เป็นผู้ดูแลระบบหลักอยู่แล้ว');
      return;
    }
    
    try {
      // Add or update allowed_emails doc
      await setDoc(doc(db, 'allowed_emails', emailToTrim), {
        email: emailToTrim,
        role: newRole,
        addedBy: user?.uid || 'admin',
        addedAt: Date.now()
      });
      
      setNewEmail('');
      setUserActionSuccess(`เพิ่มสิทธิ์อีเมล ${emailToTrim} เรียบร้อยแล้ว`);
      setTimeout(() => setUserActionSuccess(null), 3500);
    } catch (error) {
      console.error("Error adding allowed user:", error);
      setUserActionError('เกิดข้อผิดพลาดในการบันทึกสิทธิ์ผู้ใช้งาน');
    }
  };

  const handleDeleteUser = async (emailToDelete: string, uid?: string) => {
    const emailLower = emailToDelete.toLowerCase().trim();
    const specials = ['tamrri@gmail.com', 'ch.chapeach@gmail.com'];
    if (specials.includes(emailLower)) {
      alert('ไม่สามารถลบสิทธิ์ของผู้ดูแลระบบเริ่มต้นได้');
      return;
    }

    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบสิทธิ์การเข้าใช้งานของ ${emailToDelete}?`)) {
      return;
    }
    
    setUserActionSuccess(null);
    setUserActionError(null);
    
    try {
      // 1. Delete from allowed_emails
      await deleteDoc(doc(db, 'allowed_emails', emailLower));
      
      // 2. If they have already registered, downgrade role to unassigned
      if (uid) {
        await setDoc(doc(db, 'users', uid), { role: 'unassigned' }, { merge: true });
      }
      
      setUserActionSuccess(`ยกเลิกสิทธิ์การเข้าใช้งานของ ${emailToDelete} เรียบร้อยแล้ว`);
      setTimeout(() => setUserActionSuccess(null), 3500);
    } catch (error) {
      console.error("Error deleting user:", error);
      setUserActionError('เกิดข้อผิดพลาดในการลบสิทธิ์ผู้ใช้งาน');
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-red-500">กรุณาเข้าสู่ระบบ</div>;
  }
  
  const isAdmin = user.role === 'staff' || user.role === 'executive';

  const roleLabel = (role: Role) => {
    switch(role) {
      case 'executive': return <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-lg">ผู้บริหาร</span>;
      case 'staff': return <span className="px-2.5 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-lg">ผู้ดูแล/เจ้าหน้าที่</span>;
      case 'general': return <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg">บุคลากรทั่วไป</span>;
      default: return <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-lg">ยังไม่ระบุบทบาท</span>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          ตั้งค่าระบบและผู้ใช้งาน
        </h1>
        <p className="text-slate-500 mt-1">จัดการระบบเชื่อมต่อและการบริหารจัดการสิทธิ์ผู้ใช้งานในฐานข้อมูล</p>
      </header>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-5 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          การแจ้งเตือน (โทรศัพท์/PC)
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            จัดการสิทธิ์ผู้ใช้งาน ({allowedUsers.length || '...'})
          </button>
        )}
      </div>

      {/* TAB 1: NOTIFICATIONS (Web Push) */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">การแจ้งเตือนบนอุปกรณ์นี้</h2>
            <p className="text-sm text-slate-500">เปิดรับการแจ้งเตือนภารกิจใหม่บนโทรศัพท์หรือคอมพิวเตอร์ของคุณโดยตรง ไม่ต้องผ่านแอปพลิเคชันอื่น</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-500" />
                  สถานะการแจ้งเตือน
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {loadingPush ? 'กำลังตรวจสอบ...' : pushEnabled ? 'อุปกรณ์นี้เปิดรับการแจ้งเตือนแล้ว' : 'คุณยังไม่ได้เปิดการแจ้งเตือนบนอุปกรณ์นี้'}
                </p>
              </div>
              
              <button
                onClick={handleEnablePush}
                disabled={savingPush || pushEnabled || loadingPush}
                className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition shadow-sm ${
                  pushEnabled 
                    ? 'bg-green-100 text-green-700 cursor-default' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-50'
                }`}
              >
                {pushEnabled ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                {savingPush ? 'กำลังเปิดใช้งาน...' : pushEnabled ? 'เปิดใช้งานแล้ว' : 'เปิดการแจ้งเตือน'}
              </button>
            </div>

            {pushSuccess && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm flex items-center gap-2 border border-green-100 font-medium">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                {pushSuccess}
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-2">
               <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                 <Info className="w-4 h-4 text-indigo-500" />
                 คำแนะนำเพิ่มเติม
               </h3>
               <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
                 <li>สำหรับ <strong>iOS (iPhone/iPad)</strong>: กรุณากดปุ่ม Share (แชร์) และเลือก "Add to Home Screen" (เพิ่มไปยังหน้าจอโฮม) ก่อนเปิดการแจ้งเตือน</li>
                 <li>สำหรับ <strong>Android</strong>: สามารถเปิดใช้งานได้ทันทีผ่านเบราว์เซอร์ Chrome หรือเบราว์เซอร์ที่รองรับ</li>
                 <li>เมื่อกดเปิดการแจ้งเตือน เบราว์เซอร์จะถามสิทธิ์ (Permission) ให้คุณกดปุ่ม "Allow" (อนุญาต)</li>
               </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCESS CONTROL (ALLOWED EMAILS) */}
      {isAdmin && activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Add Allowed User Form */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm self-start space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800">อนุญาตผู้ใช้งานใหม่</h2>
            </div>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Mail className="w-4 h-4 text-slate-400" />
                  ที่อยู่อีเมล (Google Account)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Shield className="w-4 h-4 text-slate-400" />
                  บทบาท / สิทธิ์การใช้งาน
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition text-sm"
                >
                  <option value="general">บุคลากรทั่วไป (ทั่วไป - ดูงานได้อย่างเดียว)</option>
                  <option value="staff">เจ้าหน้าที่ / ผู้ดูแล (มีสิทธิ์เขียนตารางและตั้งค่า)</option>
                  <option value="executive">ผู้บริหาร (มีสิทธิ์เขียนตาราง ดูสถิติ และตั้งค่า)</option>
                </select>
              </div>

              {userActionError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2 border border-red-100 font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {userActionError}
                </div>
              )}

              {userActionSuccess && (
                <div className="p-3 bg-green-50 text-green-600 rounded-xl text-xs flex items-center gap-2 border border-green-100 font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {userActionSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                เพิ่มผู้ใช้งานในระบบ
              </button>
            </form>
            
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                คำแนะนำความปลอดภัย
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                เฉพาะที่อยู่อีเมลที่ระบุไว้ในหน้านี้เท่านั้นที่จะมีสิทธิ์เข้าสู่ระบบได้ อีเมลอื่นๆ นอกเหนือจากนี้จะไม่สามารถเข้าสู่ระบบและจะถูกดีดออกจากระบบทันที
              </p>
            </div>
          </div>

          {/* List of Allowed Users */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">รายชื่อผู้ใช้งานที่ได้รับสิทธิ์</h2>
                <p className="text-xs text-slate-500">ตรวจสอบ แก้ไข และลบสิทธิ์การเข้าใช้งานระบบในฐานข้อมูล</p>
              </div>
              <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100">
                ทั้งหมด {allowedUsers.length} รายการ
              </span>
            </div>

            {loadingUsers ? (
              <div className="p-12 text-center text-slate-500">กำลังโหลดรายชื่อ...</div>
            ) : allowedUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                ไม่มีรายชื่อผู้ใช้งานที่ระบุ กรุณาเพิ่มที่อยู่อีเมลด้านซ้าย
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3">อีเมลผู้ใช้งาน</th>
                      <th className="px-5 py-3">ระดับสิทธิ์</th>
                      <th className="px-5 py-3">สถานะการสมัคร</th>
                      <th className="px-5 py-3 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {allowedUsers.map((item) => {
                      const isDefaultAdmin = item.email === 'tamrri@gmail.com' || item.email === 'ch.chapeach@gmail.com';
                      return (
                        <tr key={item.email} className="hover:bg-slate-50/30 transition">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-slate-800 block break-all">{item.email}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {roleLabel(item.role)}
                          </td>
                          <td className="px-5 py-3.5">
                            {item.registered ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                เปิดใช้งานแล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                                รอล็อคอินครั้งแรก
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {isDefaultAdmin ? (
                              <span className="text-xs text-slate-400 font-medium italic pr-2">ระบบเริ่มต้น</span>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(item.email, item.uid)}
                                className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition"
                                title="ลบสิทธิ์ผู้ใช้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
